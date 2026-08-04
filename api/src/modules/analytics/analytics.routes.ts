import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../../middleware/require-auth.js";
import { analyticsRangeQuerySchema } from "./analytics.schema.js";
import * as analyticsService from "./analytics.service.js";

export const analyticsRoutes = new Hono();

analyticsRoutes.use("*", requireAuth);

analyticsRoutes.get(
  "/dashboard",
  zValidator("query", analyticsRangeQuerySchema),
  async (c) => {
    const { userId } = c.get("auth");
    return c.json(
      await analyticsService.getDashboardSummary(
        userId,
        c.req.valid("query"),
      ),
      200,
    );
  },
);

analyticsRoutes.get("/pipeline", async (c) => {
  const { userId } = c.get("auth");
  return c.json(await analyticsService.getPipelineFunnel(userId), 200);
});

analyticsRoutes.get(
  "/matches",
  zValidator("query", analyticsRangeQuerySchema),
  async (c) => {
    const { userId } = c.get("auth");
    return c.json(
      await analyticsService.getMatchQuality(userId, c.req.valid("query")),
      200,
    );
  },
);

analyticsRoutes.get("/sources", async (c) => {
  const { userId } = c.get("auth");
  return c.json(await analyticsService.getSourcePerformance(userId), 200);
});
