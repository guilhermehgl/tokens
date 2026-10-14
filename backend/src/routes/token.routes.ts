import { Router } from "express";
import { generateToken, verifyToken, getVerifiedTokensToday, getUnverifiedTokens } from "../controllers/token.controller";
import { authMiddleware } from "../middleware/auth";
import { demoWrites } from "../middleware/demoWrites";
import { rateLimitVerify } from "../middleware/rateLimit";

const router = Router();

// Gera token na tela, sem notificações externas.
router.post("/generate", authMiddleware(["vendedor", "admin"]), demoWrites, generateToken);

// Verifica token de retirada
router.post("/verify", rateLimitVerify, authMiddleware(["verificador", "admin"]), verifyToken);

// retorna tokens analisados naquele dia
router.get("/verified-today", authMiddleware(["verificador", "admin"]), getVerifiedTokensToday);

// retorna tokens ainda não verificados (registros individuais)
router.get("/unverified", authMiddleware(["verificador", "admin"]), getUnverifiedTokens);

export default router;
