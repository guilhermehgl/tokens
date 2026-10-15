import Token from "../models/Token";
import { ClientSession } from "mongoose";
import { generateTokenPlain, hashToken } from "../utils/tokenUtils";
export class TokenCollisionError extends Error {}
export const MAX_TOKEN_ATTEMPTS = 5;
// O índice único arbitra também gerações concorrentes; consultas prévias não bastam.
export async function createUniqueToken(data: {
  companyId: string;
  companyName: string;
  nfNumber: string;
  createdBy: string;
  expiresAt: Date;
  createdAt?: Date;
}, session?: ClientSession) {
  for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt++) {
    const plainToken = generateTokenPlain(6);
    try {
      const record = {
        ...data,
        tokenHash: hashToken(plainToken),
      };
      const tokenDoc = session ? (await Token.create([record], { session }))[0] : await Token.create(record);
      return { plainToken, tokenDoc };
    } catch (error) {
      const failure = error as {
        code?: number;
        keyPattern?: Record<string, unknown>;
      };
      if (failure.code !== 11000 || !failure.keyPattern?.tokenHash) throw error;
      if (session) throw error; // A colisão aborta a transação; repetir fora dela.
    }
  }
  throw new TokenCollisionError(
    "Não foi possível reservar um código exclusivo.",
  );
}
