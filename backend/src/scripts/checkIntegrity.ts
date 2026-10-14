import "dotenv/config";
import mongoose from "mongoose";
import { databaseUri } from "../config/runtime";
import { inspectDeploymentReadiness } from "../utils/deploymentReadiness";
async function main() {
  if (!process.env.INTEGRITY_DB_NAME)
    throw new Error("Informe INTEGRITY_DB_NAME explicitamente.");
  await mongoose.connect(databaseUri(), {
    autoIndex: false,
    autoCreate: false,
    serverSelectionTimeoutMS: 10000,
  });
  const db = mongoose.connection.db;
  if (!db || db.databaseName !== process.env.INTEGRITY_DB_NAME)
    throw new Error("Identidade do banco divergente.");
  // Contagens e estado dos índices: nenhum segredo ou valor de registro é impresso.
  const result = await inspectDeploymentReadiness(db);
  console.log(JSON.stringify(result, null, 2));
  if (
    result.tokens.groups ||
    result.companies.groups ||
    result.invalidTokenHashes ||
    result.nonCanonicalDocuments ||
    result.normalizedUserEmailDuplicates.groups ||
    result.indexes.some(index => index.status !== "ready")
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
