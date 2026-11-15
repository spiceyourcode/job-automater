import type { Hono } from "hono";
import { healthRoutes } from "./health.routes.js";
export const registerRoutes = (app: Hono): void => {
    app.route("/health", healthRoutes);
};
export const registerHealthRoutes = registerRoutes;
export { getHealth } from "./health.service.js";
export type { HealthResponse } from "./health.schema.js";
