import { Hono } from "hono";
import { requireAuth } from "../../middleware/require-auth.js";
import { issueWsTicket } from "../../lib/realtime.js";
export const realtimeRoutes = new Hono();
realtimeRoutes.use("*", requireAuth);
realtimeRoutes.get("/ticket", async (c) => {
    const { userId } = c.get("auth");
    return c.json(await issueWsTicket(userId), 200);
});
