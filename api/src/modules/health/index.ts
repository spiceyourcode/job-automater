import type { Hono } from "hono";
import { healthRoutes } from "./health.routes.js";

export const registerRoutes = (app: Hono): void => {
  app.route("/health", healthRoutes);
};

/** @deprecated Prefer registerRoutes — kept for clarity at call sites */
export const registerHealthRoutes = registerRoutes;

export { getHealth } from "./health.service.js";
export type { HealthResponse } from "./health.schema.js";
