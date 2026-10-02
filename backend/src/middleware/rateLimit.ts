// src/middleware/rateLimit.ts
import { Request, Response, NextFunction } from "express";

// Estrutura para armazenar contagem de requisições por IP
interface RateRecord {
  count: number;
  firstRequest: number; // timestamp do primeiro request na janela
  blockedUntil?: number;
}

// Função para criar limiter
function createMemoryLimiter(maxRequests: number, windowSeconds: number, blockSeconds: number) {
  // Cada regra mantém seu próprio contador: tráfego geral não pode consumir a
  // cota específica de login/verificação.
  const memoryStore: Record<string, RateRecord> = {};

  return (req: Request, res: Response, next: NextFunction) => {
    const ip = req.ip || "unknown-ip";
    const now = Date.now();

    let record = memoryStore[ip];

    if (record?.blockedUntil && now < record.blockedUntil) {
      const retryAfter = Math.ceil((record.blockedUntil - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ message: `Muitas requisições. Tente novamente em ${retryAfter}s.` });
    }

    if (!record) {
      record = { count: 1, firstRequest: now };
      memoryStore[ip] = record;
      return next();
    }

    // Resetar contagem se janela expirar
    if (now - record.firstRequest > windowSeconds * 1000) {
      record.count = 1;
      record.firstRequest = now;
      return next();
    }

    record.count += 1;

    if (record.count > maxRequests) {
      record.blockedUntil = now + blockSeconds * 1000;
      res.setHeader("Retry-After", String(blockSeconds));
      return res.status(429).json({ message: `Muitas requisições. Tente novamente em ${blockSeconds}s.` });
    }

    return next();
  };
}

// Rate limits
export const rateLimitGeneral = createMemoryLimiter(100, 60, 60);    // 100 req/min, bloqueio 60s
export const rateLimitLogin   = createMemoryLimiter(5, 60, 15 * 60); // 5 req/min, bloqueio 15min
export const rateLimitVerify  = createMemoryLimiter(10, 60, 10 * 60); // 10 req/min, bloqueio 10min
