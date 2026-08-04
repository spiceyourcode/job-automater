import type { Hono } from "hono";
import { jobsRoutes } from "./jobs.routes.js";

export const registerRoutes = (app: Hono): void => {
  app.route("/api/v1/jobs", jobsRoutes);
};

export * from "./jobs.schema.js";
