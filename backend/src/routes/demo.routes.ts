import { Router } from "express";
import { authMiddleware } from "../middleware/auth";
import { readDemoLimits } from "../demo/quotas";
const router = Router();
router.get("/limits", authMiddleware(), async (_req, res) => {
  try { res.json(await readDemoLimits()); }
  catch { res.status(503).json({ code: "demo_limits_unavailable", message: "Não foi possível consultar os limites. Tente novamente." }); }
});
export default router;
