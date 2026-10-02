// src/controllers/audit.controller.ts
import { Request, Response } from "express";
import AuditLog from "../models/AuditLog";

export const getAuditLogs = async (req: Request, res: Response) => {
  try {
    const logs = await AuditLog.find()
      .sort({ createdAt: -1 })
      .limit(100) // limita para não travar o frontend, pode ajustar
      .populate("performedBy", "nome email"); // se quiser mostrar o nome/email do usuário

    res.json({ success: true, logs });
  } catch (error) {
    console.error("Erro ao buscar logs:", error);
    res.status(500).json({ message: "Erro interno" });
  }
};
