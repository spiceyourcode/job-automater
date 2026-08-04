import type { Hono } from "hono";
import { teamRoutes } from "./team.routes.js";

export const registerRoutes = (app: Hono): void => {
  app.route("/api/v1/team", teamRoutes);
};

export * from "./team.schema.js";
