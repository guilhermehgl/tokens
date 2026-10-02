import { Router, Request, Response } from "express";
import AuditLog from "../models/AuditLog";
import { authMiddleware } from "../middleware/auth";

const router = Router();

// Rota para buscar auditoria (somente admin)
router.get("/", authMiddleware(["admin"]), async (req: Request, res: Response) => {
  try {
    const logs = await AuditLog.find()
      .populate("performedBy", "nome email") // Mostra quem fez a ação
      .sort({ createdAt: -1 }) // Mais recentes primeiro
      .limit(50); // Limita para evitar overload

    res.json(logs);
  } catch (error) {
    console.error("Erro ao buscar logs de auditoria:", error);
    res.status(500).json({ message: "Erro ao buscar logs de auditoria" });
  }
});

export default router;
