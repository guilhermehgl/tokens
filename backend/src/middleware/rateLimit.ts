import { Request, Response, NextFunction } from "express";
interface RateRecord {
  count: number;
  firstRequest: number;
  blockedUntil: number;
}
export function createMemoryLimiter(
  maxRequests: number,
  windowSeconds: number,
  blockSeconds: number,
  key = (req: Request) => req.ip || "unknown",
  now = Date.now,
  maxKeys = 10000,
) {
  const store = new Map<string, RateRecord>();
  const sweep = () => {
    const time = now();
    for (const [ip, record] of store)
      if (
        time >=
        Math.max(
          record.firstRequest + windowSeconds * 1000,
          record.blockedUntil,
        )
      )
        store.delete(ip);
  };
  const timer = setInterval(sweep, Math.min(windowSeconds * 1000, 60000));
  timer.unref();
  const limiter = (req: Request, res: Response, next: NextFunction) => {
    const time = now(),
      ip = key(req);
    let record = store.get(ip);
    const reject = (seconds: number) => {
      res.setHeader("Retry-After", String(Math.max(1, seconds)));
      return res
        .status(429)
        .json({
          message: "Muitas requisições. Aguarde antes de tentar novamente.",
        });
    };
    if (record && time < record.blockedUntil)
      return reject(Math.ceil((record.blockedUntil - time) / 1000));
    if (!record || time >= record.firstRequest + windowSeconds * 1000) {
      if (!record && store.size >= maxKeys) {
        sweep();
        if (store.size >= maxKeys) return reject(windowSeconds);
      }
      record = { count: 0, firstRequest: time, blockedUntil: 0 };
      store.set(ip, record);
    }
    record.count++;
    if (record.count > maxRequests) {
      record.blockedUntil = time + blockSeconds * 1000;
      return reject(blockSeconds);
    }
    next();
  };
  return Object.assign(limiter, {
    sweep,
    size: () => store.size,
    dispose: () => clearInterval(timer),
  });
}
export const rateLimitGeneral = createMemoryLimiter(100, 60, 60);
export const rateLimitLogin = createMemoryLimiter(5, 60, 900);
export const rateLimitVerify = createMemoryLimiter(10, 60, 600);
