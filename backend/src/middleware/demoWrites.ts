import { Request, Response, NextFunction } from "express";
import { createMemoryLimiter } from "./rateLimit";
// As credenciais são compartilhadas: a cota é global por conta, independente do IP.
const limiter = createMemoryLimiter(
  30,
  3600,
  3600,
  (req) => req.userId || req.ip || "unknown",
);
export function demoWrites(req: Request, res: Response, next: NextFunction) {
  if (req.userIsDemo && !["GET", "HEAD", "OPTIONS"].includes(req.method))
    return limiter(req, res, next);
  next();
}
