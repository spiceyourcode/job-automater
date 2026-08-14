import type { Hono } from "hono";
import { realtimeRoutes } from "./realtime.routes.js";

export const registerRoutes = (app: Hono): void => {
  app.route("/api/v1/realtime", realtimeRoutes);
};
