// app.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import { connectDB } from "./config/db";

// Rotas
import authRoutes from "./routes/auth.routes";
import companyRoutes from "./routes/company.routes";
import tokenRoutes from "./routes/token.routes";
import userRoutes from "./routes/user.routes";
import auditRoutes from "./routes/audit.routes";

// Middleware de rate limit
import { rateLimitGeneral } from "./middleware/rateLimit";

const app = express();
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
      return callback(new Error("Origem não permitida por CORS"));
    },
    credentials: false,
  })
);
app.use(express.json());
app.use(rateLimitGeneral);
app.use(
  helmet({
    contentSecurityPolicy: false,
    crossOriginOpenerPolicy: false,
    crossOriginEmbedderPolicy: false,
    hsts: false // desativa Strict-Transport-Security
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

// ----------------------------
// START SERVER
// ----------------------------
const PORT = Number(process.env.PORT) || 3003;

connectDB()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Servidor rodando na porta ${PORT} e acessível na rede`);
    });
  })
  .catch((err) => {
    console.error("Erro ao conectar no DB:", err);
  });

export default app;
