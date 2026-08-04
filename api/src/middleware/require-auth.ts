import type { Context, MiddlewareHandler, Next } from "hono";
import { verifyAccessToken } from "../lib/jwt.js";
import type { WorkspaceRole } from "../db/schema/workspaces.js";

export interface AuthContext {
  userId: string;
  email: string;
  role: WorkspaceRole;
  workspaceId: string;
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
    c.set("auth", {
      userId: payload.sub,
      email: payload.email,
      role: payload.role,
      workspaceId: payload.workspaceId,
    });
  } catch {
    c.res = c.json({ error: "unauthorized" }, 401);
    return;
  }

  await next();
};

/** HG-2: declare allowed roles on protected mutating routes. */
export const requireRole =
  (...allowed: WorkspaceRole[]): MiddlewareHandler =>
  async (c, next) => {
    const auth = c.get("auth");
    if (!auth || !allowed.includes(auth.role)) {
      c.res = c.json({ error: "forbidden" }, 403);
      return;
    }
    await next();
  };
