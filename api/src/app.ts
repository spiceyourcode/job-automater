import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { apiRateLimit } from "./middleware/api-rate-limit.js";
import { requestLog } from "./middleware/request-log.js";
import { buildOpenApiDocument } from "./lib/openapi.js";
import { log } from "./lib/logger.js";
import { captureUnhandled } from "./lib/sentry.js";
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
import { registerRoutes as registerRealtimeRoutes } from "./modules/realtime/index.js";
import { registerRoutes as registerRecruitersRoutes } from "./modules/recruiters/index.js";

export const createApp = (): Hono => {
  const app = new Hono();

  app.onError((err, c) => {
    if (err instanceof HTTPException) {
      return err.getResponse();
    }
    log.error("unhandled_error", {
      path: c.req.path,
      method: c.req.method,
      name: err instanceof Error ? err.name : "Error",
    });
    captureUnhandled(err);
    return c.json({ error: "internal_error" }, 500);
  });

  app.use("*", requestLog);
  // Schema §2.1 — before routes so anonymous floods cannot skip limits
  app.use("*", apiRateLimit);

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
  registerRealtimeRoutes(app);
  registerRecruitersRoutes(app);

  // OpenAPI from registered Hono routes (P12.2)
  app.get("/api/v1/openapi.json", (c) => c.json(buildOpenApiDocument(app)));

  app.notFound((c) => c.json({ error: "not_found" }, 404));

  return app;
};
