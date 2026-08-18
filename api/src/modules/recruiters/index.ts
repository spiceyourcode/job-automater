import type { Hono } from "hono";
import { recruitersRoutes } from "./recruiters.routes.js";

export const registerRoutes = (app: Hono): void => {
  app.route("/api/v1/recruiters", recruitersRoutes);
};

export * from "./recruiters.schema.js";
