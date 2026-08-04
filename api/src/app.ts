import { Hono } from "hono";
import { registerRoutes as registerHealthRoutes } from "./modules/health/index.js";
import { registerRoutes as registerAuthRoutes } from "./modules/auth/index.js";

export const createApp = (): Hono => {
  const app = new Hono();

  registerHealthRoutes(app);
  registerAuthRoutes(app);

  app.notFound((c) => c.json({ error: "not_found" }, 404));

  return app;
};
