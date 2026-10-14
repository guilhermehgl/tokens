// src/controllers/audit.controller.ts
import { Request, Response } from "express";
import AuditLog from "../models/AuditLog";

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(100) // limita para não travar o frontend, pode ajustar
      .populate("performedBy", "nome email").lean();

    // Não retornar códigos/hash eventualmente existentes em auditorias antigas.
    res.json({ success: true, logs: logs.map(log => {
      const info = { ...log.info };
      delete info.token; delete info.verifiedToken; delete info.tokenHash;
      return { ...log, info };
    }) });
  } catch (error) {
    console.error("Erro ao buscar logs:", error);
    res.status(500).json({ message: "Erro interno" });
  }
};
