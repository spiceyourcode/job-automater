import type { Hono } from "hono";
import { billingRoutes, billingWebhookRoutes } from "./billing.routes.js";

export const registerRoutes = (app: Hono): void => {
  // Register webhook first so requireAuth on /billing cannot steal POST /webhook (HG-2).
  app.route("/api/v1/billing/webhook", billingWebhookRoutes);
  app.route("/api/v1/billing", billingRoutes);
};
