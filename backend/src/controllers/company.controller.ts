import { Request, Response } from "express";
import { Company } from "../models/Company";
import { companyInput } from "../utils/companyValidation";
import { persistenceError, validId } from "../utils/validation";
import { logAction } from "../utils/audit";
import { isDemoCompany } from "../demo/accounts";
export const createCompany = async (req: Request, res: Response) => {
  let data;
  try {
    data = companyInput(req.body);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
  try {
    if (await Company.findOne({ documento: data.documento }))
      return res.status(409).json({ message: "Empresa já cadastrada." });
    const company = await Company.create(data);
    if (req.userId)
      await logAction("CREATE_COMPANY", req.userId, "Company", {
        companyId: company._id,
        companyName: company.razaoSocial,
        documento: company.documento,
        role: req.userRole,
        ip: req.ip,
      });
    return res.status(201).json({ success: true, company });
  } catch (error) {
    return persistenceError(res, error);
  }
};
export const listCompanies = async (_req: Request, res: Response) => {
  try {
    const companies = await Company.find().sort({ createdAt: -1 });
    return res.json({
      success: true,
      companies: companies.map((company) => ({
        ...(typeof company.toObject === "function"
          ? company.toObject()
          : company),
        isDemo: isDemoCompany(company),
      })),
    });
  } catch (error) {
    return persistenceError(res, error);
  }
};
export const updateCompany = async (req: Request, res: Response) => {
  if (!validId(req.params.id))
    return res.status(400).json({ message: "ID inválido." });
  let data;
  try {
    data = companyInput(req.body, true);
  } catch (error) {
    return res.status(400).json({ message: (error as Error).message });
  }
  try {
    const company = await Company.findById(req.params.id);
    if (!company)
      return res.status(404).json({ message: "Empresa não encontrada." });
    if (req.userIsDemo && isDemoCompany(company))
      return res
        .status(403)
        .json({ message: "Os dados fictícios iniciais são protegidos." });
    const tipo = data.tipoDocumento || company.tipoDocumento,
      documento = data.documento || company.documento;
    if (documento.length !== (tipo === "CPF" ? 11 : 14))
      return res
        .status(400)
        .json({ message: "Documento incompatível com o tipo." });
    data.documento = documento;
    data.tipoDocumento = tipo;
    const updated = await Company.findByIdAndUpdate(req.params.id, data, {
      new: true,
      runValidators: true,
    });
    if (!updated)
      return res.status(404).json({ message: "Empresa não encontrada." });
    if (req.userId)
      await logAction("EDIT_COMPANY", req.userId, "Company", {
        companyId: updated._id,
        companyName: updated.razaoSocial,
        role: req.userRole,
        ip: req.ip,
      });
    return res.json({
      success: true,
      message: "Empresa atualizada com sucesso.",
      company: updated,
    });
  } catch (error) {
    return persistenceError(res, error);
  }
};
