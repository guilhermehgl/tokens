import Token from "../models/Token";
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
}) {
  for (let attempt = 0; attempt < MAX_TOKEN_ATTEMPTS; attempt++) {
    const plainToken = generateTokenPlain(6);
    try {
      const tokenDoc = await Token.create({
        ...data,
        tokenHash: hashToken(plainToken),
      });
      return { plainToken, tokenDoc };
    } catch (error) {
      const failure = error as {
        code?: number;
        keyPattern?: Record<string, unknown>;
      };
      if (failure.code !== 11000 || !failure.keyPattern?.tokenHash) throw error;
    }
  }
  throw new TokenCollisionError(
    "Não foi possível reservar um código exclusivo.",
  );
}
