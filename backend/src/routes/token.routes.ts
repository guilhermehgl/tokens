import { Router } from "express";
import { generateToken, verifyToken, getVerifiedTokensToday, getUnverifiedTokens } from "../controllers/token.controller";
import { authMiddleware } from "../middleware/auth";
import { rateLimitVerify } from "../middleware/rateLimit";

const router = Router();

// Gera token e envia por email
router.post("/generate", authMiddleware(["vendedor", "admin"]), generateToken);

// Verifica token de retirada
router.post("/verify", rateLimitVerify, authMiddleware(["verificador", "admin"]), verifyToken);

// retorna tokens analisados naquele dia
router.get("/verified-today", authMiddleware(["verificador", "admin"]), getVerifiedTokensToday);

// retorna tokens ainda não verificados (agrupados por empresa + NF)
router.get("/unverified", authMiddleware(["verificador", "admin"]), getUnverifiedTokens);

export default router;
