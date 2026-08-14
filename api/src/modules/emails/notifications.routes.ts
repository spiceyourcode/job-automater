import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../../middleware/require-auth.js";
import {
  notificationIdParamSchema,
  patchNotificationPrefsBodySchema,
} from "./emails.schema.js";
import * as emailsService from "./emails.service.js";

export const notificationsRoutes = new Hono();

const isErr = (err: unknown): err is emailsService.EmailsError =>
  err instanceof emailsService.EmailsError;

notificationsRoutes.use("*", requireAuth);

notificationsRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");
  return c.json(await emailsService.listNotifications(userId), 200);
});

notificationsRoutes.post("/read-all", async (c) => {
  const { userId } = c.get("auth");
  return c.json(await emailsService.markAllNotificationsRead(userId), 200);
});

notificationsRoutes.get("/preferences", async (c) => {
  const { userId } = c.get("auth");
  return c.json(await emailsService.getNotificationPreferences(userId), 200);
});

notificationsRoutes.patch(
  "/preferences",
  zValidator("json", patchNotificationPrefsBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await emailsService.patchNotificationPreferences(
          userId,
          c.req.valid("json"),
        ),
        200,
      );
    } catch (err) {
      if (isErr(err)) return c.json({ error: err.message }, err.statusCode);
      throw err;
    }
  },
);

notificationsRoutes.patch(
  "/:id/read",
  zValidator("param", notificationIdParamSchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await emailsService.markNotificationRead(
          userId,
          c.req.valid("param").id,
        ),
        200,
      );
    } catch (err) {
      if (isErr(err)) return c.json({ error: err.message }, err.statusCode);
      throw err;
    }
  },
);
