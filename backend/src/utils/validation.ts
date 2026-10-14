import { Response } from "express";
export const validEmail = (value: unknown): value is string =>
  typeof value === "string" &&
  value.length <= 254 &&
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
export const validName = (value: unknown): value is string =>
  typeof value === "string" &&
  value.trim().length >= 2 &&
  value.trim().length <= 160;
export const validPassword = (value: unknown): value is string =>
  typeof value === "string" &&
  Buffer.byteLength(value, "utf8") <= 72 &&
  value.length >= 8 &&
  /[A-Za-z]/.test(value) &&
  /\d/.test(value) &&
  /[^A-Za-z0-9]/.test(value);
export const validId = (value: unknown): value is string =>
  typeof value === "string" && /^[a-f\d]{24}$/i.test(value);
export function persistenceError(res: Response, error: unknown) {
  const failure = error as { code?: number; name?: string };
  if (failure?.code === 11000)
    return res
      .status(409)
      .json({ message: "Já existe um registro com esses dados exclusivos." });
  if (["ValidationError", "CastError"].includes(failure?.name || ""))
    return res
      .status(400)
      .json({ message: "Dados inválidos. Confira os campos informados." });
  return res
    .status(500)
    .json({ message: "Não foi possível concluir a operação." });
}
