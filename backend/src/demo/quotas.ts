import mongoose, { ClientSession } from "mongoose";
import { Response } from "express";
import { demoEnabled } from "./environment";
import { demoDay } from "./day";
import { TokenCollisionError, MAX_TOKEN_ATTEMPTS } from "../services/token.service";

type Kind = "users" | "companies" | "tokens";
type QuotaDocument = { _id: string; revision?: number; used?: number };
export class DemoLimitError extends Error {
  constructor(public readonly kind: Kind, public readonly used: number, public readonly nextReset?: string) {
    super(kind === "tokens" ? "Limite diário atingido: a demonstração permite gerar até 10 tokens por dia. Novas gerações estarão disponíveis amanhã." :
      `Limite da demonstração atingido: já existem ${used} ${kind === "users" ? "usuários" : "empresas"}. Não é possível criar novos registros neste momento.`);
  }
}

export { demoDay } from "./day";

const active = { active: { $ne: false } };
const info = (maximum: number, used: number) => ({ maximum, used, remaining: Math.max(0, maximum - used) });
function dailyUsage(daily: QuotaDocument | null) {
  if (daily && (!Number.isSafeInteger(daily.used) || daily.used! < 0)) throw new Error("Contador demonstrativo inválido.");
  return daily?.used;
}
async function initialDailyUsage(session?: ClientSession, start?: Date, end?: Date) {
  const tokens = mongoose.connection.db!.collection("tokens");
  if (await tokens.countDocuments({ createdAt: { $not: { $type: "date" } } }, { session })) throw new Error("Datas legadas precisam de revisão antes da cota diária.");
  return tokens.countDocuments({ createdAt: { $gte: start, $lt: end } }, { session });
}

// Uma escrita no mesmo documento serializa todas as operações de capacidade.
// Contagem + gravação + contador diário pertencem à mesma transação: rollback
// libera a reserva automaticamente. Não há contadores decrementar/reparar.
export async function demoWrite<T>(kind: Kind | "deleteUser", operation: (session?: ClientSession, issuedAt?: Date) => Promise<T>, now?: Date): Promise<T> {
  if (!demoEnabled()) return operation();
  const db = mongoose.connection.db!;
  const quotas = db.collection<QuotaDocument>("demoquotas");
  for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt++) {
    const session = await mongoose.startSession();
    try {
      return (await session.withTransaction(async () => {
        await quotas.updateOne({ _id: "capacity" }, { $inc: { revision: 1 } }, { upsert: true, session });
        const issuedAt = now ?? new Date();
        const { day, start, end } = demoDay(issuedAt);
        let used = 0;
        if (kind === "users" || kind === "companies") {
          used = await db.collection(kind).countDocuments(active, { session });
          if (used >= 50) throw new DemoLimitError(kind, used);
        }
        if (kind === "tokens") {
          const daily = await quotas.findOne({ _id: `tokens:${day}` }, { session });
          used = dailyUsage(daily) ?? await initialDailyUsage(session, start, end);
          if (used >= 10) throw new DemoLimitError("tokens", used, end.toISOString());
        }
        const result = await operation(session, issuedAt);
        if (kind === "tokens") await quotas.updateOne({ _id: `tokens:${day}` }, { $set: { used: used + 1 } }, { upsert: true, session });
        return result;
      }, { readConcern: { level: "snapshot" }, writeConcern: { w: "majority" }, readPreference: "primary", maxCommitTimeMS: 10000 })) as T;
    } catch (error) {
      const failure = error as { code?: number; keyPattern?: Record<string, unknown> };
      // Conflito na primeira criação do mutex ou colisão do hash: nova transação.
      // Nunca repetir uma transação com resultado de commit desconhecido aqui.
      if (failure.code === 11000 && (failure.keyPattern?.tokenHash || failure.keyPattern?._id)) {
        if (attempt + 1 < MAX_TOKEN_ATTEMPTS) continue;
        if (failure.keyPattern?.tokenHash) throw new TokenCollisionError();
      }
      throw error;
    } finally { await session.endSession(); }
  }
  throw new Error("Operação demonstrativa indisponível.");
}

export async function readDemoLimits(now = new Date()) {
  if (!demoEnabled()) return { enabled: false };
  const db = mongoose.connection.db!;
  const { day, start, end } = demoDay(now);
  const daily = await db.collection<QuotaDocument>("demoquotas").findOne({ _id: `tokens:${day}` });
  return { enabled: true, users: info(50, await db.collection("users").countDocuments(active)),
    companies: info(50, await db.collection("companies").countDocuments(active)),
    tokens: { ...info(10, dailyUsage(daily) ?? await initialDailyUsage(undefined, start, end)), nextReset: end.toISOString(), timeZone: "America/Sao_Paulo" } };
}

export function demoError(res: Response, error: unknown) {
  if (!(error instanceof DemoLimitError)) return false;
  if (error.nextReset) res.setHeader("Retry-After", String(Math.max(1, Math.ceil((Date.parse(error.nextReset) - Date.now()) / 1000))));
  res.status(error.kind === "tokens" ? 429 : 409).json({ code: error.kind === "tokens" ? "demo_tokens_daily_limit" : `demo_${error.kind}_limit`, message: error.message,
    limit: { type: error.kind, ...info(error.kind === "tokens" ? 10 : 50, error.used), ...(error.nextReset ? { nextReset: error.nextReset } : {}) } });
  return true;
}
