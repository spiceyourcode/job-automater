import type { Hono } from "hono";
import { profileRoutes } from "./profile.routes.js";

export const registerRoutes = (app: Hono): void => {
  app.route("/api/v1/profile", profileRoutes);
};

export * from "./profile.schema.js";
