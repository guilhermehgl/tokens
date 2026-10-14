// app.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { connectDB } from "./config/db";
import { assertRuntime } from "./config/runtime";

// Rotas
import authRoutes from "./routes/auth.routes";
import companyRoutes from "./routes/company.routes";
import tokenRoutes from "./routes/token.routes";
import userRoutes from "./routes/user.routes";
import auditRoutes from "./routes/audit.routes";

// Middleware de rate limit
import { rateLimitGeneral } from "./middleware/rateLimit";

const app = express();
app.use((_req, res, next) => { res.setHeader("Cache-Control", "no-store"); next(); });
// Aceita somente lista explícita de endereços/sub-redes dos proxies confiáveis.
app.set("trust proxy", process.env.TRUST_PROXY ? process.env.TRUST_PROXY.split(",").map(value => value.trim()) : false);
const allowedOrigins = (process.env.CORS_ORIGINS || "http://localhost:5173")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
console.log("Origens permitidas pelo CORS:", allowedOrigins.join(", "));

// ----------------------------
// MIDDLEWARES
// ----------------------------
app.use(
  cors({
    origin(origin, callback) {
      // Requisições sem Origin (ex.: health checks servidor-a-servidor) não
      // precisam de CORS. No navegador, aceite apenas origens configuradas.
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(Object.assign(new Error("Origem não permitida"), { status: 403 }));
    },
    credentials: false,
  })
);
app.use(express.json({ limit: "32kb" }));
app.disable("x-powered-by");
app.use(rateLimitGeneral);
app.use(
  helmet({
    contentSecurityPolicy: { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } },
    crossOriginOpenerPolicy: { policy: "same-origin" },
    crossOriginEmbedderPolicy: false,
    hsts: process.env.HTTPS_ENABLED === "true" ? { maxAge: 15552000 } : false
  })
);


// ----------------------------
// ROTAS DE API
// ----------------------------
app.use("/api/auth", authRoutes);
app.use("/api/companies", companyRoutes);
app.use("/api/tokens", tokenRoutes);
app.use("/api/users", userRoutes);
app.use("/api/audit", auditRoutes);
app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use((error: { type?: string; status?: number }, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  // Não expor stack, conteúdo da requisição ou detalhes dos provedores.
  const status = error?.type === "entity.parse.failed" ? 400 : error?.type === "entity.too.large" ? 413 : error?.status === 403 ? 403 : 500;
  res.status(status).json({ message: status === 400 ? "Corpo JSON inválido." : "Não foi possível concluir a requisição." });
});

// ----------------------------
// START SERVER
// ----------------------------
const PORT = Number(process.env.PORT) || 3003;

if (require.main === module) {
  try { assertRuntime(); } catch (error) { console.error((error as Error).message); process.exit(1); }
  connectDB()
  .then(async () => {
    const { default: Token } = await import("./models/Token");
    const { Company } = await import("./models/Company");
    const { default: User } = await import("./models/User");
    const { inspectIntegrity } = await import("./utils/integrity");
    const integrity = await inspectIntegrity(Token.db.db!);
    if (integrity.tokens.groups || integrity.companies.groups || integrity.invalidTokenHashes || integrity.nonCanonicalDocuments) throw new Error("Revise a integridade do banco antes de iniciar.");
    await Token.createIndexes(); await Company.createIndexes(); await User.createIndexes();
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Servidor rodando na porta ${PORT} e acessível na rede`);
    });
  })
  .catch((err) => {
    console.error("Inicialização recusada. Confira conexão, isolamento e configuração do ambiente.");
    process.exit(1);
  });
}

export default app;
