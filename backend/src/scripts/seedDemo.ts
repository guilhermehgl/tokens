import "dotenv/config";
import mongoose from "mongoose";
import { assertRuntime } from "../config/runtime";
import { connectDB } from "../config/db";
import { seedDemo } from "../demo/seed";

async function main() {
  assertRuntime();
  await connectDB();
  await seedDemo();
  console.log("Contas e empresas fictícias inicializadas. Nenhuma mensagem enviada.");
}
main().catch(() => { console.error("Inicialização demo recusada. Confira o banco e as configurações."); process.exitCode = 1; }).finally(() => mongoose.disconnect());
