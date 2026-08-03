import { Hono } from "hono";
import { registerRoutes } from "./modules/health/index.js";

export const createApp = (): Hono => {
  const app = new Hono();

  registerRoutes(app);

  app.notFound((c) => c.json({ error: "not_found" }, 404));

  return app;
};
