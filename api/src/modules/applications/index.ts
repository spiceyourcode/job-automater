import type { Hono } from "hono";
import { applicationsRoutes } from "./applications.routes.js";

export const registerRoutes = (app: Hono): void => {
  app.route("/api/v1/applications", applicationsRoutes);
};

export * from "./applications.schema.js";
