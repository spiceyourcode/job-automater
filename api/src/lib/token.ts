import { createHash, randomBytes } from "node:crypto";
import { env } from "../env.js";
const parseTtlDate = (ttl: string): Date => {
    const match = /^(\d+)([smhd])$/.exec(ttl);
    if (!match)
        throw new Error(`Invalid TTL format: ${ttl}`);
    const value = Number(match[1]);
    const unit = match[2] as "s" | "m" | "h" | "d";
    const multipliers = { s: 1000, m: 60000, h: 3600000, d: 86400000 };
    return new Date(Date.now() + value * multipliers[unit]);
};
export const generateRefreshToken = (): string => randomBytes(40).toString("hex");
export const generateAuthActionToken = (): string => randomBytes(32).toString("hex");
export const hashToken = (token: string): string => createHash("sha256").update(token).digest("hex");
export const refreshTokenExpiry = (): Date => parseTtlDate(env.jwtRefreshTtl);
export const emailVerifyExpiry = (): Date => parseTtlDate(env.emailVerifyTtl);
export const passwordResetExpiry = (): Date => parseTtlDate(env.passwordResetTtl);
