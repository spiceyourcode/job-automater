import { Hono } from "hono";
import { registerRoutes as registerHealthRoutes } from "./modules/health/index.js";
import { registerRoutes as registerAuthRoutes } from "./modules/auth/index.js";
import { registerRoutes as registerProfileRoutes } from "./modules/profile/index.js";
import { registerRoutes as registerSourcesRoutes } from "./modules/sources/index.js";

export const createApp = (): Hono => {
  const app = new Hono();

  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerProfileRoutes(app);
  registerSourcesRoutes(app);

  app.notFound((c) => c.json({ error: "not_found" }, 404));

  return app;
};
