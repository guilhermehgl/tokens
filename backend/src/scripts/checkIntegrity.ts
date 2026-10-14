import "dotenv/config";
import mongoose from "mongoose";
import { databaseUri } from "../config/runtime";
import { inspectIntegrity } from "../utils/integrity";
async function main() {
  if (!process.env.INTEGRITY_DB_NAME)
    throw new Error("Informe INTEGRITY_DB_NAME explicitamente.");
  await mongoose.connect(databaseUri(), {
    autoIndex: false,
    serverSelectionTimeoutMS: 10000,
  });
  const db = mongoose.connection.db;
  if (!db || db.databaseName !== process.env.INTEGRITY_DB_NAME)
    throw new Error("Identidade do banco divergente.");
  // Somente contagens: nenhum hash, documento, segredo ou registro é impresso.
  const result = await inspectIntegrity(db);
  console.log(JSON.stringify(result, null, 2));
  if (
    result.tokens.groups ||
    result.companies.groups ||
    result.invalidTokenHashes ||
    result.nonCanonicalDocuments
  )
    process.exitCode = 1;
}
main()
  .catch(() => {
    console.error(
      "Verificação recusada ou indisponível; nenhum dado alterado.",
    );
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
