import { Hono } from "hono";
import { emailsRoutes, gmailAuthRoutes, gmailPushRoutes } from "./emails.routes.js";
import { notificationsRoutes } from "./notifications.routes.js";

export const registerRoutes = (app: Hono): void => {
  const emailsRoot = new Hono();
  // Push must be registered before the auth-gated router (same /emails prefix).
  emailsRoot.route("/gmail/push", gmailPushRoutes);
  emailsRoot.route("/", emailsRoutes);
  app.route("/api/v1/emails", emailsRoot);
  app.route("/api/v1/auth/gmail", gmailAuthRoutes);
  app.route("/api/v1/notifications", notificationsRoutes);
};

export * from "./emails.schema.js";
