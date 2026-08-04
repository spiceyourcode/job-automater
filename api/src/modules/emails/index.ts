import type { Hono } from "hono";
import { emailsRoutes } from "./emails.routes.js";

export const registerRoutes = (app: Hono): void => {
  app.route("/api/v1/emails", emailsRoutes);
};

export * from "./emails.schema.js";
