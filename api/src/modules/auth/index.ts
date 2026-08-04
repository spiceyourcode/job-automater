import type { Hono } from "hono";
import { authRoutes } from "./auth.routes.js";

export const registerRoutes = (app: Hono): void => {
  app.route("/api/v1/auth", authRoutes);
};

export * from "./auth.schema.js";
