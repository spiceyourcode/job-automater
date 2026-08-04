import type { Hono } from "hono";
import { sourcesRoutes } from "./sources.routes.js";

export const registerRoutes = (app: Hono): void => {
  app.route("/api/v1/sources", sourcesRoutes);
};

export * from "./sources.schema.js";
