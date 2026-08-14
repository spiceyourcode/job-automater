import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth, requireRole } from "../../middleware/require-auth.js";
import { emergencyStopBodySchema } from "./automation.schema.js";
import * as automationService from "./automation.service.js";

export const automationRoutes = new Hono();

const isAutoError = (
  err: unknown,
): err is automationService.AutomationError =>
  err instanceof automationService.AutomationError;

automationRoutes.use("*", requireAuth);

automationRoutes.get(
  "/status",
  requireRole("owner", "member", "viewer"),
  async (c) => {
    const { userId } = c.get("auth");
    return c.json(await automationService.getAutomationStatus(userId), 200);
  },
);

automationRoutes.post(
  "/emergency-stop",
  requireRole("owner", "member"),
  zValidator("json", emergencyStopBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      const body = c.req.valid("json");
      return c.json(
        await automationService.emergencyStop(userId, body.active),
        200,
      );
    } catch (err) {
      if (isAutoError(err)) {
        return c.json({ error: err.message }, err.statusCode);
      }
      throw err;
    }
  },
);
