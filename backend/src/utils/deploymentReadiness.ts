import { Db } from "mongodb";
import { inspectIntegrity } from "./integrity";

// Diagnóstico somente leitura. Não usa modelos, init, createIndexes ou syncIndexes.
export async function inspectDeploymentReadiness(db: Db) {
  const email = { $toLower: { $trim: { input: {
    $convert: { input: "$email", to: "string", onError: "", onNull: "" },
  } } } };
  const duplicates = await db.collection("users").aggregate([
    { $group: { _id: email, count: { $sum: 1 } } },
    { $match: { count: { $gt: 1 } } },
    { $group: { _id: null, groups: { $sum: 1 }, records: { $sum: "$count" } } },
    { $project: { _id: 0, groups: 1, records: 1 } },
  ]).toArray();
  const indexes = [];
  for (const [collection, field, kind] of [
    ["tokens", "tokenHash", "unique"],
    ["companies", "documento", "unique"],
    ["users", "email", "unique"],
    ["tokens", "expiresAt", "ttl"],
  ]) {
    const existing = await db.collection(collection).listIndexes().toArray().catch(error => {
      if (error.code === 26) return [];
      throw error;
    });
    const sameKey = existing.filter(index => Object.keys(index.key).length === 1 && index.key[field] === 1);
    const ready = sameKey.some(index => !index.partialFilterExpression && !index.sparse &&
      (!index.collation || index.collation.locale === "simple") &&
      (kind === "unique" ? index.unique === true : index.expireAfterSeconds === 0));
    indexes.push({ collection, field, kind, status: ready ? "ready" : sameKey.length ? "conflicting" : "missing" });
  }
  return {
    ...await inspectIntegrity(db),
    normalizedUserEmailDuplicates: duplicates[0] || { groups: 0, records: 0 },
    indexes,
  };
}
