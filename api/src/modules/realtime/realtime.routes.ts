import { Hono } from "hono";
import { requireAuth } from "../../middleware/require-auth.js";
import { issueWsTicket } from "../../lib/realtime.js";

export const realtimeRoutes = new Hono();

realtimeRoutes.use("*", requireAuth);

/** Short-lived ticket so the browser never holds a refresh token (HG-1). */
realtimeRoutes.get("/ticket", async (c) => {
  const { userId } = c.get("auth");
  return c.json(await issueWsTicket(userId), 200);
});
