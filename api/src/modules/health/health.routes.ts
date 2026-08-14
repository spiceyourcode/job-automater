import { Hono } from "hono";
import { getFeatureFlags } from "../../lib/feature-flags.js";
import { getHealth } from "./health.service.js";

export const healthRoutes = new Hono();

healthRoutes.get("/", async (c) => {
  const { body, ok } = await getHealth();
  return c.json(body, ok ? 200 : 503);
});

/** Public feature flags — booleans only, never secrets (P12.3). */
healthRoutes.get("/flags", (c) => c.json(getFeatureFlags()));
