import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../../middleware/require-auth.js";
import {
  analyticsExportQuerySchema,
  analyticsRangeQuerySchema,
} from "./analytics.schema.js";
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

analyticsRoutes.get("/cv-ab", async (c) => {
  const { userId } = c.get("auth");
  return c.json(await analyticsService.getCvAbReport(userId), 200);
});

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

analyticsRoutes.get(
  "/skills",
  zValidator("query", analyticsRangeQuerySchema),
  async (c) => {
    const { userId } = c.get("auth");
    return c.json(
      await analyticsService.getSkillGaps(userId, c.req.valid("query")),
      200,
    );
  },
);

analyticsRoutes.get(
  "/export",
  zValidator("query", analyticsExportQuerySchema),
  async (c) => {
    const { userId } = c.get("auth");
    const file = await analyticsService.buildAnalyticsExport(
      userId,
      c.req.valid("query"),
    );
    return new Response(new Uint8Array(file.body), {
      status: 200,
      headers: {
        "Content-Type": file.contentType,
        "Content-Disposition": `attachment; filename="${file.filename}"`,
      },
    });
  },
);
