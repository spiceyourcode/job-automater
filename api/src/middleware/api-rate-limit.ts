import type { MiddlewareHandler } from "hono";
import { verifyAccessToken } from "../lib/jwt.js";
import {
  anonKeyFromIp,
  consumeApiRateLimit,
  type RateLimitResult,
} from "../lib/rate-limit.js";

const SKIP_PREFIXES = ["/health", "/api/v1/ws", "/api/v1/openapi.json"] as const;

function clientIp(c: {
  req: { header: (name: string) => string | undefined };
}): string | undefined {
  return (
    c.req.header("cf-connecting-ip") ??
    c.req.header("x-real-ip") ??
    c.req.header("x-forwarded-for")
  );
}

function applyHeaders(
  c: { header: (k: string, v: string) => void },
  result: RateLimitResult,
): void {
  c.header("X-RateLimit-Limit", String(result.limit));
  c.header("X-RateLimit-Remaining", String(result.remaining));
  c.header("X-RateLimit-Reset", String(result.resetSec));
}

/**
 * Schema §2.1 — 100/min auth, 20/min anonymous.
 * FAILURE: unauthenticated flood must not be unbounded.
 */
export const apiRateLimit: MiddlewareHandler = async (c, next) => {
  const path = c.req.path;
  if (SKIP_PREFIXES.some((p) => path === p || path.startsWith(`${p}/`))) {
    await next();
    return;
  }

  let userId: string | null = null;
  const header = c.req.header("Authorization");
  if (header?.startsWith("Bearer ")) {
    const token = header.slice(7).trim();
    if (token) {
      try {
        const payload = await verifyAccessToken(token);
        userId = payload.sub;
      } catch {
        // Invalid token → anonymous bucket (still limited)
      }
    }
  }

  const result = await consumeApiRateLimit({
    userId,
    anonKey: anonKeyFromIp(clientIp(c)),
  });
  applyHeaders(c, result);

  if (!result.allowed) {
    // HG-8: no IP / userId in logs
    console.warn(
      JSON.stringify({
        event: "api_rate_limited",
        kind: result.kind,
      }),
    );
    c.header("Retry-After", String(result.resetSec));
    return c.json({ error: "rate_limited" }, 429);
  }

  await next();
};
