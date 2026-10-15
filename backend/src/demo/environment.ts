import mongoose from "mongoose";
import { databaseUri } from "../config/runtime";
import { Db } from "mongodb";
const confirmed = new WeakSet<Db>();

function configuredDatabase() {
  if (!process.env.DEMO_ENABLED || process.env.DEMO_ENABLED === "false") return null;
  if (process.env.DEMO_ENABLED !== "true") throw new Error("Configuração demonstrativa inválida.");
  const uri = new URL(databaseUri());
  const dbName = decodeURIComponent(uri.pathname.slice(1)) || "test";
  if (!process.env.DEMO_DB_NAME || !process.env.DEMO_DB_HOST ||
      dbName !== process.env.DEMO_DB_NAME || uri.hostname !== process.env.DEMO_DB_HOST ||
      mongoose.connection.db?.databaseName !== dbName) {
    throw new Error("Identidade do ambiente demonstrativo não confirmada.");
  }
  return mongoose.connection.db!;
}

// Somente leitura: o marcador é preparado pelo seed LOCAL ou por uma operação
// de infraestrutura revisada e autorizada. Nunca criá-lo implicitamente.
export async function confirmDemoEnvironment() {
  const db = configuredDatabase();
  if (!db) return;
  const marker = await db.collection<{ _id: string; purpose: string }>("demo_environment")
    .findOne({ _id: "portal-tokens-demo-v1", purpose: "public-demo" });
  if (!marker) throw new Error("Banco sem marcador demonstrativo autorizado.");
  confirmed.add(db);
}

export function demoEnabled() {
  const db = configuredDatabase();
  if (!db) return false;
  if (!confirmed.has(db)) throw new Error("Ambiente demonstrativo não confirmado nesta conexão.");
  return true;
}

export const testEmail = (email: string) => /^[^\s@]+@(?:[a-z\d-]+\.)*(?:example|test)$/i.test(email);
