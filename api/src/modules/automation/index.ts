import type { Hono } from "hono";
import { automationRoutes } from "./automation.routes.js";

export const registerRoutes = (app: Hono): void => {
  app.route("/api/v1/automation", automationRoutes);
};

export * from "./automation.schema.js";
