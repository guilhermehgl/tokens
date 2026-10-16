import { Db } from "mongodb";
export async function inspectIntegrity(db: Db) {
  const duplicates = async (collection: string, field: string) => {
    const result = await db
      .collection(collection)
      .aggregate([
        { $group: { _id: `$${field}`, count: { $sum: 1 } } },
        { $match: { count: { $gt: 1 } } },
        {
          $group: {
            _id: null,
            groups: { $sum: 1 },
            records: { $sum: "$count" },
          },
        },
        { $project: { _id: 0, groups: 1, records: 1 } },
      ])
      .toArray();
    return result[0] || { groups: 0, records: 0 };
  };
  return {
    tokens: await duplicates("tokens", "tokenHash"),
    companies: await duplicates("companies", "documento"),
    invalidTokenHashes: await db
      .collection("tokens")
      .countDocuments({ tokenHash: { $not: /^[a-f\d]{64}$/ } }),
    nonCanonicalDocuments: await db
      .collection("companies")
      .countDocuments({ documento: { $not: /^\d{11}$|^\d{14}$/ } }),
  };
}
