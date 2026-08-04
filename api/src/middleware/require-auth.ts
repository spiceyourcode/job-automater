import type { Context, MiddlewareHandler, Next } from "hono";
import { verifyAccessToken } from "../lib/jwt.js";

export interface AuthContext {
  userId: string;
  email: string;
}

declare module "hono" {
  interface ContextVariableMap {
    auth: AuthContext;
  }
}

export const requireAuth: MiddlewareHandler = async (
  c: Context,
  next: Next,
): Promise<void> => {
  const header = c.req.header("Authorization");
  if (!header?.startsWith("Bearer ")) {
    c.res = c.json({ error: "unauthorized" }, 401);
    return;
  }

  const token = header.slice(7).trim();
  if (!token) {
    c.res = c.json({ error: "unauthorized" }, 401);
    return;
  }

  try {
    const payload = await verifyAccessToken(token);
    c.set("auth", { userId: payload.sub, email: payload.email });
  } catch {
    c.res = c.json({ error: "unauthorized" }, 401);
    return;
  }

  await next();
};
