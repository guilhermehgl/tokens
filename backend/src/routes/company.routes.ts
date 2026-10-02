import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { createCompany, listCompanies, updateCompany } from "../controllers/company.controller";

const router = Router();

// ✅ Listar empresas (qualquer usuário autenticado)
router.get("/", authMiddleware(), listCompanies);

// ✅ Criar empresa (apenas vendedores)
router.post("/", authMiddleware(["vendedor"]), createCompany);

// ✅ Editar empresa (apenas vendedores)
router.put("/:id", authMiddleware(["vendedor", "admin"]), updateCompany);

export default router;
