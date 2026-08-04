import type { Hono } from "hono";
import { analyticsRoutes } from "./analytics.routes.js";

export const registerRoutes = (app: Hono): void => {
  app.route("/api/v1/analytics", analyticsRoutes);
};

export * from "./analytics.schema.js";
