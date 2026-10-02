import { Router } from "express";
import { login, register, refreshToken } from "../controllers/auth.controller";
import { authMiddleware } from "../middleware/auth";
import { rateLimitLogin } from "../middleware/rateLimit";

const router = Router();

router.post("/login", rateLimitLogin, login);
router.post("/refresh-token", authMiddleware(), refreshToken);

// A criação de contas é uma operação administrativa. Não exponha uma rota
// pública de cadastro, pois ela permitiria criar vendedores/verificadores.
router.post("/create", authMiddleware(["admin"]), register);

export default router;
