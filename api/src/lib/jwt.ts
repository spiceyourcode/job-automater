import { SignJWT, jwtVerify } from "jose";
import { env } from "../env.js";

export interface AccessTokenPayload {
  sub: string;
  email: string;
  role: "owner" | "member" | "viewer";
  workspaceId: string;
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
  return new SignJWT({
    email: payload.email,
    role: payload.role,
    workspaceId: payload.workspaceId,
  })
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
  if (
    typeof payload.sub !== "string" ||
    typeof payload.email !== "string" ||
    typeof payload.role !== "string" ||
    typeof payload.workspaceId !== "string"
  ) {
    throw new Error("Invalid token payload");
  }
  if (!["owner", "member", "viewer"].includes(payload.role)) {
    throw new Error("Invalid role in token");
  }
  return {
    sub: payload.sub,
    email: payload.email,
    role: payload.role as AccessTokenPayload["role"],
    workspaceId: payload.workspaceId,
  };
};
