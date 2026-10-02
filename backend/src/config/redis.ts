import Redis from "ioredis";

let redis: Redis | null = null;

try {
  redis = new Redis({
    host: process.env.REDIS_HOST,
    port: parseInt(process.env.REDIS_PORT || "6379"),
    password: process.env.REDIS_PASSWORD || undefined,
    enableReadyCheck: true,
    lazyConnect: false,
  });

  redis.on("error", (e) => console.warn("Redis não disponível, fallback para memória:", e.message));
} catch (err) {
  console.warn("Não foi possível conectar ao Redis, usando fallback em memória.");
  redis = null;
}

export { redis };