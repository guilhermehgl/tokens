import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { getAuditLogs } from "../controllers/audit.controller";
const router = Router();
router.get("/", authMiddleware(["admin"]), getAuditLogs);
export default router;
