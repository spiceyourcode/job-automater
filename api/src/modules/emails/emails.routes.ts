import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../../middleware/require-auth.js";
import {
  notificationIdParamSchema,
  syncEmailsBodySchema,
} from "./emails.schema.js";
import * as emailsService from "./emails.service.js";

export const emailsRoutes = new Hono();

const isErr = (err: unknown): err is emailsService.EmailsError =>
  err instanceof emailsService.EmailsError;

emailsRoutes.use("*", requireAuth);

emailsRoutes.post(
  "/sync",
  zValidator("json", syncEmailsBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await emailsService.syncEmails(userId, c.req.valid("json")),
        202,
      );
    } catch (err) {
      if (isErr(err)) return c.json({ error: err.message }, err.statusCode);
      throw err;
    }
  },
);

emailsRoutes.get("/", async (c) => {
  const { userId } = c.get("auth");
  return c.json(await emailsService.listEmails(userId), 200);
});

emailsRoutes.get("/notifications", async (c) => {
  const { userId } = c.get("auth");
  return c.json(await emailsService.listNotifications(userId), 200);
});

emailsRoutes.patch(
  "/notifications/:id/read",
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
