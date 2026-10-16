import { Router } from "express";
import { demoWrites } from "../middleware/demoWrites";
import { authMiddleware } from "../middleware/auth";
import { createCompany, listCompanies, updateCompany } from "../controllers/company.controller";

const router = Router();

// ✅ Listar empresas (qualquer usuário autenticado)
router.get("/", authMiddleware(), listCompanies);

// ✅ Criar empresa (apenas vendedores)
router.post("/", authMiddleware(["vendedor"]), demoWrites, createCompany);

// ✅ Editar empresa (apenas vendedores)
router.put("/:id", authMiddleware(["vendedor", "admin"]), demoWrites, updateCompany);

export default router;
