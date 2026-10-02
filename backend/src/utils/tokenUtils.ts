// src/utils/tokenUtils.ts
import crypto from "crypto";

/**
 * Gera um token de 6 caracteres, misturando letras maiúsculas e números.
 * Garante que haja pelo menos 1 número.
 */
export function generateTokenPlain(length = 6): string {
  if (length < 2) {
    throw new Error("O token deve ter ao menos dois caracteres");
  }

  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const numbers = "0123456789";
  const tokenChars = [numbers[crypto.randomInt(numbers.length)]];

  // Garantir pelo menos 1 número
  const allChars = letters + numbers;
  for (let i = 1; i < length; i++) {
    tokenChars.push(allChars[crypto.randomInt(allChars.length)]);
  }

  // Fisher-Yates com fonte criptograficamente segura: o número não fica
  // sempre na primeira posição e não há viés de Math.random().
  for (let i = tokenChars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(i + 1);
    [tokenChars[i], tokenChars[j]] = [tokenChars[j], tokenChars[i]];
  }

  return tokenChars.join("");
}

/**
 * Criptografa o token usando SHA-256
 */
export function hashToken(token: string): string {
  return crypto.createHash("sha256").update(token).digest("hex");
}
