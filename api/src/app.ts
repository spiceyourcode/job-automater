import { Hono } from "hono";
import { registerRoutes as registerHealthRoutes } from "./modules/health/index.js";
import { registerRoutes as registerAuthRoutes } from "./modules/auth/index.js";
import { registerRoutes as registerProfileRoutes } from "./modules/profile/index.js";
import { registerRoutes as registerSourcesRoutes } from "./modules/sources/index.js";
import { registerRoutes as registerJobsRoutes } from "./modules/jobs/index.js";
import { registerRoutes as registerApplicationsRoutes } from "./modules/applications/index.js";
import { registerRoutes as registerEmailsRoutes } from "./modules/emails/index.js";
import { registerRoutes as registerAnalyticsRoutes } from "./modules/analytics/index.js";
import { registerRoutes as registerTeamRoutes } from "./modules/team/index.js";
import { registerRoutes as registerAutomationRoutes } from "./modules/automation/index.js";

export const createApp = (): Hono => {
  const app = new Hono();

  registerHealthRoutes(app);
  registerAuthRoutes(app);
  registerProfileRoutes(app);
  registerSourcesRoutes(app);
  registerJobsRoutes(app);
  registerApplicationsRoutes(app);
  registerEmailsRoutes(app);
  registerAnalyticsRoutes(app);
  registerTeamRoutes(app);
  registerAutomationRoutes(app);

  app.notFound((c) => c.json({ error: "not_found" }, 404));

  return app;
};
