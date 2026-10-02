import { Request, Response } from "express";
import { Company } from "../models/Company";
import AuditLog from "../models/AuditLog";
import { logAction } from "../utils/audit";
import { isValidE164 } from "../utils/phone";


// Tipagem para request com userId e userRole
interface AuthRequest extends Request {
  userId?: string;
  userRole?: string;
}

// ----------------------------
// CRIAR EMPRESA
// ----------------------------
export const createCompany = async (req: AuthRequest, res: Response) => {
  try {
    const { razaoSocial, documento, tipoDocumento, emailReferencia, telefone } = req.body;

    if (!razaoSocial || !documento || !tipoDocumento || !emailReferencia) {
      return res.status(400).json({ message: "Todos os campos são obrigatórios." });
    }

    if (tipoDocumento === "CNPJ" && documento.length !== 14) {
      return res.status(400).json({ message: "CNPJ incompleto! Digite todos os 14 dígitos." });
    }

    if (tipoDocumento === "CPF" && documento.length !== 11) {
      return res.status(400).json({ message: "CPF incompleto! Digite todos os 11 dígitos." });
    }

    if (!isValidE164(telefone)) {
      return res.status(400).json({ message: "Informe um telefone válido com o código do país." });
    }

    const existing = await Company.findOne({ documento });
    if (existing) {
      return res.status(400).json({ message: "Empresa já cadastrada." });
    }

    const company = await Company.create({
      razaoSocial,
      documento,
      tipoDocumento,
      emailReferencia,
      telefone,
      createdBy: req.userId,
    });

    // Auditoria usando o campo info
    if (req.userId) {
      await AuditLog.create({
        action: "CREATE_COMPANY",
        performedBy: req.userId,
        info: {
          razaoSocial: company.razaoSocial,
          documento: company.documento,
          tipoDocumento: company.tipoDocumento,
          emailReferencia: company.emailReferencia,
          role: req.userRole,
          ip:
            req.ip ||
            req.headers["x-forwarded-for"] ||
            req.socket.remoteAddress,
        },
      });
    }

    res.status(201).json({ success: true, company });
  } catch (error) {
    console.error("Erro ao criar empresa:", error);
    res.status(500).json({ message: "Erro interno ao criar empresa." });
  }
};

// ----------------------------
// LISTAR EMPRESAS
// ----------------------------
export const listCompanies = async (req: AuthRequest, res: Response) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    res.json({ success: true, companies });
  } catch (error) {
    console.error("Erro ao listar empresas:", error);
    res.status(500).json({ message: "Erro interno." });
  }
};

// ----------------------------
// ATUALIZAR EMPRESA
// ----------------------------
export const updateCompany = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { razaoSocial, documento, tipoDocumento, emailReferencia, telefone } = req.body;

    if (Object.prototype.hasOwnProperty.call(req.body, "telefone") && !isValidE164(telefone)) {
      return res.status(400).json({ message: "Informe um telefone válido com o código do país." });
    }

    const updateData: any = {};
    if (razaoSocial) updateData.razaoSocial = razaoSocial;
    if (documento) updateData.documento = documento;
    if (tipoDocumento) updateData.tipoDocumento = tipoDocumento;
    if (emailReferencia) updateData.emailReferencia = emailReferencia;
    if (telefone !== undefined) updateData.telefone = telefone;

    const updatedCompany = await Company.findByIdAndUpdate(id, updateData, { new: true });

    if (!updatedCompany) {
      return res.status(404).json({ message: "Empresa não encontrada." });
    }

    // 🔹 Auditoria — usando o helper padronizado
    if (req.userId) {
      await logAction(
        "EDIT_COMPANY",
        req.userId,
        "Company",
        {
          razaoSocial: updatedCompany.razaoSocial,
          documento: updatedCompany.documento,
          tipoDocumento: updatedCompany.tipoDocumento,
          emailReferencia: updatedCompany.emailReferencia,
          telefone: updatedCompany.telefone,
          role: req.userRole,
          ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
        }
      );
    }

    res.json({
      success: true,
      message: "Empresa atualizada com sucesso.",
      company: updatedCompany,
    });
  } catch (error) {
    console.error("Erro ao atualizar empresa:", error);
    res.status(500).json({ message: "Erro interno." });
  }
};
