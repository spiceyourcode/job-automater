import { SignJWT, jwtVerify } from "jose";
import { env } from "../env.js";

export interface AccessTokenPayload {
  sub: string;
  email: string;
}

const getSecret = (): Uint8Array =>
  new TextEncoder().encode(env.jwtSecret);

/**
 * Parses a duration string like "15m", "7d" into seconds.
 * Supported units: s, m, h, d.
 */
const parseTtlSeconds = (ttl: string): number => {
  const match = /^(\d+)([smhd])$/.exec(ttl);
  if (!match) throw new Error(`Invalid TTL format: ${ttl}`);
  const value = Number(match[1]);
  const unit = match[2] as "s" | "m" | "h" | "d";
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  return value * multipliers[unit];
};

export const signAccessToken = async (
  payload: AccessTokenPayload,
): Promise<string> => {
  const ttlSeconds = parseTtlSeconds(env.jwtAccessTtl);
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(getSecret());
};

export const verifyAccessToken = async (
  token: string,
): Promise<AccessTokenPayload> => {
  const { payload } = await jwtVerify(token, getSecret(), {
    algorithms: ["HS256"],
  });
  if (typeof payload.sub !== "string" || typeof payload.email !== "string") {
    throw new Error("Invalid token payload");
  }
  return { sub: payload.sub, email: payload.email };
};
