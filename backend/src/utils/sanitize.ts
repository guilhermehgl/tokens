import { Types } from "mongoose";
const confidential =
  /token(?!id$)|password|passwd|senha|secret|authorization|authentication|cookie|jwt|credential|apikey|privatekey|recoveryuuid/i;
export function sanitize(value: unknown): unknown {
  if (value instanceof Types.ObjectId) return value.toHexString();
  if (Array.isArray(value)) return value.map(sanitize);
  if (value instanceof Date || value === null || typeof value !== "object")
    return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !confidential.test(key.replace(/[_\s-]/g, "")))
      .map(([key, item]) => [key, sanitize(item)]),
  );
}
