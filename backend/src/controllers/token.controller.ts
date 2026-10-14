import { Request, Response } from "express";
import { Types } from "mongoose";
import Token from "../models/Token";
import { Company, CompanyDocument } from "../models/Company";
import { hashToken } from "../utils/tokenUtils";
import { sendEmail, validateEmailConfiguration } from "../utils/email";
import { logAction } from "../utils/audit";
import { createUniqueToken, TokenCollisionError } from "../services/token.service";
import { validId } from "../utils/validation";
import mjml2html from "mjml";
import { normalizeWhatsappPhone, validateWhatsappConfiguration, sendWhatsappText, whatsappTokenMessage } from "../services/whatsapp.service";

// Integrações preservadas para referência/reutilização; a geração pública não chama esta função.
export async function deliverToken(company: CompanyDocument, nfNumber: string, plainToken: string, deliveryChannel: "email" | "whatsapp") {
  let deliveryMessageId: string | undefined;
  const saudacao = new Date().getHours() < 12 ? "Bom dia" : "Boa tarde";
  if (deliveryChannel === "whatsapp") { normalizeWhatsappPhone(company.telefone); validateWhatsappConfiguration(); }
  else validateEmailConfiguration();
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
                <mj-text font-size="22px" font-weight="bold">Portal de Tokens</mj-text>
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
      const { html } = await mjml2html(mjmlTemplate);

      // Envia email
      await sendEmail(
        company.emailReferencia,
        "Token de Retirada",
        html
      );
    }

  return deliveryMessageId;
}

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

    if (!req.userId) return res.status(401).json({ message: "Usuário não autenticado" });
    if (!["vendedor", "admin"].includes(req.userRole || "")) return res.status(403).json({ message: "Acesso negado" });
    if (!validId(companyId)) return res.status(400).json({ message: "Informe companyId" });
    if (!nfNumber) return res.status(400).json({ message: "Número da NF é obrigatório" });
    if (typeof nfNumber !== "string" || !/^\d{9}$/.test(nfNumber)) return res.status(400).json({ message: "A NF deve ter exatamente 9 dígitos." });
    const company: CompanyDocument | null = await Company.findById(companyId);
    if (!company) return res.status(404).json({ message: "Empresa não encontrada" });

    const expiresAt = new Date(Date.now() + 30 * 86400000);
    const { plainToken, tokenDoc } = await createUniqueToken({ companyId, companyName: company.razaoSocial, nfNumber, createdBy: req.userId, expiresAt });
    tokenCreated = true;
    await logAction("GENERATE_TOKEN", req.userId, "Token", { companyId, companyName: company.razaoSocial, nfNumber, expiresAt, deliveryChannel: "screen", role: req.userRole });
    res.setHeader("Cache-Control", "no-store");
    return res.json({ success: true, token: plainToken, tokenId: tokenDoc._id, expiresAt, deliveryChannel: "screen", message: "Token gerado. Copie o código exibido na tela." });
  } catch (error) {

    console.error("Falha ao gerar token.", { tokenCreated });
    res.status(error instanceof TokenCollisionError ? 503 : 500).json({ message: "Não foi possível gerar o token. Tente novamente mais tarde.", tokenCreated });
  }
};

// ----------------------------
// VERIFICAR TOKEN
// ----------------------------
export const verifyToken = async (req: AuthRequest, res: Response) => {
  try {
    const { token } = req.body;

    if (!req.userId) return res.status(401).json({ message: "Usuário não autenticado" });
    if (typeof token !== "string" || !/^[A-Z0-9]{6}$/.test(token)) {
      return res.status(400).json({ code: "invalid_token", message: "Informe um token com exatamente 6 letras maiúsculas ou números. A retirada não foi liberada." });
    }

    const tokenHash = hashToken(token);

    const usedAt = new Date();
    // A condição e o consumo ocorrem numa única operação no MongoDB.
    const tokenDoc = await Token.findOneAndUpdate({
      tokenHash,
      used: false,
      expiresAt: { $gt: usedAt }
    }, { $set: { used: true, usedBy: new Types.ObjectId(req.userId), usedAt } }, { new: true, runValidators: true });

    if (!tokenDoc) {
      const existing = await Token.findOne({ tokenHash });
      if (!existing) return res.status(400).json({ code: "invalid_token", message: "Token não encontrado. Confira o código informado. A retirada não foi liberada." });
      if (existing.used) return res.status(400).json({ code: "used_token", message: "Este token já foi utilizado. Não é possível liberar outra retirada com o mesmo código." });
      if (existing.expiresAt <= new Date()) return res.status(400).json({ code: "expired_token", message: "Este token está vencido. Solicite um novo token ao vendedor. A retirada não foi liberada." });
      return res.status(400).json({ code: "invalid_token", message: "Não foi possível validar este token. A retirada não foi liberada." });
    }

    // Snapshot já retornado pela operação atômica; nenhuma consulta secundária pode invalidar o sucesso.
    const companyName = tokenDoc.companyName;

    // 🔍 Auditoria — corrigida e padronizada
    await logAction("VERIFY_TOKEN", req.userId, "Token", {
      companyId: tokenDoc.companyId,
      companyName,
      nfNumber: tokenDoc.nfNumber || undefined,
      usedAt: tokenDoc.usedAt,
      role: req.userRole,
      ip:
        req.ip,
    });

    res.json({
      success: true,
      message: `Token válido! Liberação concedida. ✅`,
      tokenData: {
        token,
        companyName,
        nfNumber: tokenDoc.nfNumber || "Não informada",
        usedAt: tokenDoc.usedAt,
        expiresAt: tokenDoc.expiresAt
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
    }).select("companyName nfNumber usedAt expiresAt").sort({ usedAt: -1 });

    res.json({ tokens });
  } catch (error) {
    console.error("TOKEN_QUERY_FAILED");
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
    }).select("companyName nfNumber createdAt expiresAt").sort({ createdAt: -1, _id: -1 }).lean();

    if (!tokens || tokens.length === 0) {
      return res.json({ tokens: [] });
    }

    res.json({ tokens: tokens.map(t => ({
      _id: t._id,
      companyName: t.companyName || "Empresa não encontrada",
      nfNumber: t.nfNumber || "Não informada",
      createdAt: t.createdAt,
      expiresAt: t.expiresAt,
    })) });
  } catch (error) {
    console.error("TOKEN_QUERY_FAILED");
    res.status(500).json({ message: "Erro interno" });
  }
};
