import mongoose from "mongoose";
import bcrypt from "bcrypt";
import User from "../models/User";
import { Company } from "../models/Company";
import { demoAccounts, demoPassword } from "./accounts";

export async function seedDemo() {
  const db = mongoose.connection.db;
  if (!db) throw new Error("Banco demo não conectado.");
  if (!db.databaseName.endsWith("_demo")) throw new Error("O nome do banco deve terminar em _demo.");
  const marker = db.collection("demo_environment");
  if (!await marker.findOne({ _id: "portal-tokens-demo-v1" as never })) {
    const collections = await db.listCollections().toArray();
    for (const collection of collections) {
      if (await db.collection(collection.name).estimatedDocumentCount() > 0) throw new Error("Banco não identificado como demo contém dados. Use um banco vazio; nenhum dado foi alterado.");
    }
    await marker.updateOne({ _id: "portal-tokens-demo-v1" as never }, { $setOnInsert: { purpose: "public-demo" } }, { upsert: true });
  }
  const password = await bcrypt.hash(demoPassword, 10);
  for (const account of demoAccounts) {
    await User.updateOne({ email: account.email }, { $setOnInsert: { ...account, password, isDemo: true } }, { upsert: true, runValidators: true });
  }
  for (const [index, razaoSocial] of ["Horizonte Comércio Demo", "Aurora Logística Demo", "Oficina Exemplo Demo"].entries()) {
    const documento = `0000000000000${index + 1}`;
    await Company.updateOne({ documento }, { $setOnInsert: { razaoSocial, documento, tipoDocumento: "CNPJ", emailReferencia: `empresa${index + 1}@example.com`, telefone: "+12025550123" } }, { upsert: true, runValidators: true });
  }
}
