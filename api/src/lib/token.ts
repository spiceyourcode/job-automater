import { createHash, randomBytes } from "node:crypto";
import { env } from "../env.js";

/**
 * Returns a duration string like "7d" as a future Date.
 */
const parseTtlDate = (ttl: string): Date => {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) throw new Error(`Invalid TTL format: ${ttl}`);
  const value = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  const multipliers = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return new Date(Date.now() + value * multipliers[unit]);
};

/** Generates a cryptographically random opaque refresh token. */
export const generateRefreshToken = (): string =>
  randomBytes(40).toString("hex");

/** Returns the SHA-256 hex digest of a token (for DB storage). */
export const hashToken = (token: string): string =>
  createHash("sha256").update(token).digest("hex");

/** Returns the expiry Date for a new refresh token based on env config. */
export const refreshTokenExpiry = (): Date =>
  parseTtlDate(env.jwtRefreshTtl);
