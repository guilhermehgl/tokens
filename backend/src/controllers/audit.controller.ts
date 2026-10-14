// src/controllers/audit.controller.ts
import { Request, Response } from "express";
import AuditLog from "../models/AuditLog";
import { sanitize } from "../utils/sanitize";

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(100) // limita para não travar o frontend, pode ajustar
      .populate("performedBy", "nome email").lean();

    // Não retornar códigos/hash eventualmente existentes em auditorias antigas.
    res.json(sanitize(logs));
  } catch (error) {
    console.error("AUDIT_READ_FAILED");
    res.status(500).json({ message: "Erro interno" });
  }
};
