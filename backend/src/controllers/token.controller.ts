import { Request, Response } from "express";
import { Types } from "mongoose";
import path from "path";
import Token from "../models/Token";
import { Company, CompanyDocument } from "../models/Company"; 
import { generateTokenPlain, hashToken } from "../utils/tokenUtils";
import { sendEmail } from "../utils/email";
import { logAction } from "../utils/audit";
import mjml2html from "mjml";
import { normalizeWhatsappPhone, validateWhatsappConfiguration, sendWhatsappText, whatsappTokenMessage, WhatsappDeliveryError } from "../services/whatsapp.service";

// Tipagem para request com userId
interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

// ----------------------------
// GERAR TOKEN
// ----------------------------
export const generateToken = async (req: AuthRequest, res: Response) => {
  let tokenCreated = false;
  try {
    const { companyId, nfNumber } = req.body;
    const deliveryChannel = req.body.deliveryChannel ?? "email";

    if (!req.userId) return res.status(401).json({ message: "Usuário não autenticado" });
    if (!companyId) return res.status(400).json({ message: "Informe companyId" });
    if (!nfNumber) return res.status(400).json({ message: "Número da NF é obrigatório" });

    if (deliveryChannel !== "email" && deliveryChannel !== "whatsapp") {
      return res.status(400).json({ message: "Escolha um canal de envio válido: e-mail ou WhatsApp." });
    }

    const company: CompanyDocument | null = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: "Empresa não encontrada" });

    // Valida destinatário/configuração antes de criar um token que não pode ser enviado.
    if (deliveryChannel === "whatsapp") {
      normalizeWhatsappPhone(company.telefone);
      validateWhatsappConfiguration();
    }

    // Saudação dinâmica
    const horaAtual = new Date().getHours();
    const saudacao = horaAtual < 12 ? "Bom dia" : "Boa tarde";

    // Token simples + hash
    const plainToken = generateTokenPlain(6);
    const tokenHash = hashToken(plainToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 dias

    const tokenDoc = await Token.create({
      companyId,
      companyName: company.razaoSocial,
      nfNumber,
      tokenHash,
      createdBy: new Types.ObjectId(req.userId),
      expiresAt
    });

    tokenCreated = true;
    let deliveryMessageId: string | undefined;
    if (deliveryChannel === "whatsapp") {
      const delivery = await sendWhatsappText(company.telefone, whatsappTokenMessage(company.razaoSocial, String(nfNumber), plainToken));
      deliveryMessageId = delivery.messageId;
    } else {
      // Monta o MJML
      const mjmlTemplate = `
        <mjml>
          <mj-body>
            <mj-section>
              <mj-column width="550px" background-color="#c6ddedff" border-radius="1px">
                <mj-image border-radius="5px" padding="30px" src="cid:logoEmpresa"/>
                <mj-text font-size="29px" color="#333">${saudacao}!</mj-text>
                <mj-column width="450px" align="center">
                  <mj-text font-size="18px" align="center">
                    Informamos que o seu pedido foi faturado.<br/>
                    Informe o token abaixo para retirada do(s) produto(s) referente à NF <b>${nfNumber}</b>.
                  </mj-text>
                </mj-column>
                <mj-button border-radius="10px" width="200px" height="50px" background-color="#032354" color="white" font-size="22px" font-weight="bold">
                  Token: ${plainToken}
                </mj-button>
                <mj-text font-size="15px" align="center">
                  Este token é válido por 30 dias a partir do recebimento deste email.
                </mj-text>
              </mj-column>
            </mj-section>
          </mj-body>
        </mjml>
      `;
  
      // Converte MJML → HTML
      const { html } = mjml2html(mjmlTemplate);
  
      // Envia email
      await sendEmail(
        company.emailReferencia,
        "Token de Retirada",
        html,
        [
          {
            filename: "elmaz_logo.png",
            path: path.join(__dirname, "../assets/elmaz_logo.png"),
            cid: "logoEmpresa",
          },
        ]
      );
    }

// Auditoria
await logAction(
  "GENERATE_TOKEN",
  req.userId,
  "Token", // targetType
  {
    companyId,
    companyName: company.razaoSocial,
    nfNumber,
    expiresAt,
    deliveryChannel,
    deliveryDestination: deliveryChannel === "email" ? company.emailReferencia : company.telefone,
    ...(deliveryMessageId ? { deliveryMessageId, deliveryStatus: "accepted" } : {}),
    role: req.userRole,
    ip:
      req.ip ||
      req.headers["x-forwarded-for"] ||
      req.socket.remoteAddress,
  }
);


    res.json({ success: true, message: deliveryChannel === "email" ? "Token gerado e enviado por e-mail." : "Token gerado e enviado por WhatsApp.", tokenId: tokenDoc._id, deliveryChannel, ...(deliveryMessageId ? { deliveryMessageId, deliveryStatus: "accepted" } : {}) });
  } catch (error) {
    if (error instanceof WhatsappDeliveryError) {
      console.error("Falha no envio WhatsApp:", { reason: error.reason, providerStatus: error.providerStatus, tokenCreated });
      return res.status(error.status).json({ message: error.message, code: error.reason, tokenCreated });
    }
    console.error("Falha ao gerar/enviar token.", { tokenCreated });
    res.status(500).json({ message: "Não foi possível gerar ou enviar o token.", tokenCreated });
  }
};

// ----------------------------
// VERIFICAR TOKEN
// ----------------------------
export const verifyToken = async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body;

    if (!req.userId) return res.status(401).json({ message: "Usuário não autenticado" });
    if (!token) return res.status(400).json({ message: "Token é obrigatório" });

    const tokenHash = hashToken(token);

    const tokenDoc = await Token.findOne({
      tokenHash,
      used: false,
      expiresAt: { $gt: new Date() }
    });

    if (!tokenDoc) return res.status(400).json({ message: "Token inválido ou expirado ❌" });

    // Marca token como usado
    tokenDoc.used = true;
    tokenDoc.usedBy = new Types.ObjectId(req.userId);
    tokenDoc.usedAt = new Date();
    tokenDoc.verifiedToken = token;
    await tokenDoc.save();

    const company: CompanyDocument | null = await Company.findById(tokenDoc.companyId);
    const companyName = company ? company.razaoSocial : "Empresa não encontrada";

    // 🔍 Auditoria — corrigida e padronizada
    await logAction("VERIFY_TOKEN", req.userId, "Token", {
      companyId: tokenDoc.companyId,
      companyName,
      nfNumber: tokenDoc.nfNumber || undefined,
      usedAt: tokenDoc.usedAt,
      role: req.userRole,
      ip:
        req.ip ||
        req.headers["x-forwarded-for"] ||
        req.socket.remoteAddress,
    });

    res.json({
      success: true,
      message: `Token válido! Liberação concedida. ✅`,
      tokenData: {
        token,
        companyName,
        nfNumber: tokenDoc.nfNumber || "Não informada"
      }
    });
  } catch (error) {
    console.error("Erro ao verificar token.");
    res.status(500).json({ message: "Erro interno" });
  }
};


// ----------------------------
// TOKENS DO DIA
// ----------------------------
export const getVerifiedTokensToday = async (req: Request, res: Response) => {
  try {
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const tokens = await Token.find({
      used: true,
      usedAt: { $gte: startOfDay }
    }).sort({ usedAt: -1 });

    res.json({ tokens });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Erro interno" });
  }
};

// ----------------------------
// TOKENS NÃO VERIFICADOS
// ------------------------
export const getUnverifiedTokens = async (req: Request, res: Response) => {
  try {
    const tokens = await Token.find({
      used: false,
      expiresAt: { $gt: new Date() }
    }).lean();

    if (!tokens || tokens.length === 0) {
      return res.json({ tokens: [] });
    }

    // Agrupar por empresa + NF
    const grouped = tokens.reduce((acc: any, t: any) => {
      const companyName = t.companyName || "Empresa não encontrada";
      const nfNumber = t.nfNumber || "Não informada";
      const key = `${companyName}-${nfNumber}`;

      if (!acc[key]) {
        acc[key] = {
          companyName,
          nfNumber,
          count: 0,
        };
      }
      acc[key].count++;
      return acc;
    }, {});

    res.json({ tokens: Object.values(grouped) });
  } catch (error) {
    console.error("Erro ao buscar tokens não verificados:", error);
    res.status(500).json({ message: "Erro interno" });
  }
};
