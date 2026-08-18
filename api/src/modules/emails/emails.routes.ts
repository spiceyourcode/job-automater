import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { requireAuth } from "../../middleware/require-auth.js";
import { env } from "../../env.js";
import { gmailConnectWhy } from "../../lib/gmail.js";
import { log, publicErrorFields } from "../../lib/logger.js";
import {
  classifyEmailBodySchema,
  emailIdParamSchema,
  gmailPushQuerySchema,
  notificationIdParamSchema,
  syncEmailsBodySchema,
} from "./emails.schema.js";
import * as emailsService from "./emails.service.js";

export const emailsRoutes = new Hono();
export const gmailAuthRoutes = new Hono();

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

emailsRoutes.get("/review", async (c) => {
  const { userId } = c.get("auth");
  return c.json(await emailsService.listReviewQueue(userId), 200);
});

emailsRoutes.post(
  "/:id/classify",
  zValidator("param", emailIdParamSchema),
  zValidator("json", classifyEmailBodySchema),
  async (c) => {
    const { userId } = c.get("auth");
    try {
      return c.json(
        await emailsService.classifyEmail(
          userId,
          c.req.valid("param").id,
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

emailsRoutes.get("/gmail", async (c) => {
  const { userId } = c.get("auth");
  return c.json(await emailsService.getGmailStatus(userId), 200);
});

emailsRoutes.post("/gmail/sync", async (c) => {
  const { userId } = c.get("auth");
  try {
    return c.json(await emailsService.syncGmailHistory(userId), 202);
  } catch (err) {
    if (isErr(err)) return c.json({ error: err.message }, err.statusCode);
    throw err;
  }
});

emailsRoutes.post("/gmail/watch", async (c) => {
  const { userId } = c.get("auth");
  try {
    return c.json(await emailsService.renewGmailWatch(userId), 200);
  } catch (err) {
    if (isErr(err)) return c.json({ error: err.message }, err.statusCode);
    throw err;
  }
});

emailsRoutes.delete("/gmail", async (c) => {
  const { userId } = c.get("auth");
  try {
    return c.json(await emailsService.disconnectGmail(userId), 200);
  } catch (err) {
    if (isErr(err)) return c.json({ error: err.message }, err.statusCode);
    throw err;
  }
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

/** Start mailbox OAuth — tokens never returned (HG-1). */
gmailAuthRoutes.get("/", requireAuth, async (c) => {
  const { userId } = c.get("auth");
  try {
    return c.json(await emailsService.startGmailOAuth(userId), 200);
  } catch (err) {
    if (isErr(err)) return c.json({ error: err.message }, err.statusCode);
    throw err;
  }
});

gmailAuthRoutes.get("/callback", async (c) => {
  const code = c.req.query("code");
  const state = c.req.query("state");
  const dest = new URL("/settings/sources", env.appUrl);
  if (!code || !state) {
    dest.searchParams.set("gmail", "error");
    dest.searchParams.set("why", "missing");
    return c.redirect(dest.toString(), 302);
  }
  try {
    await emailsService.completeGmailOAuth({ code, state });
    dest.searchParams.set("gmail", "connected");
    return c.redirect(dest.toString(), 302);
  } catch (err) {
    log.error("gmail_oauth_callback_failed", publicErrorFields(err));
    dest.searchParams.set("gmail", "error");
    dest.searchParams.set("why", gmailConnectWhy(err));
    return c.redirect(dest.toString(), 302);
  }
});

/** Google Pub/Sub push — optional shared token; never logs message data (HG-8). */
export const gmailPushRoutes = new Hono();
gmailPushRoutes.post(
  "/",
  zValidator("query", gmailPushQuerySchema),
  async (c) => {
    try {
      const body = await c.req.json().catch(() => ({}));
      const token = c.req.valid("query").token;
      return c.json(await emailsService.handleGmailPush(body, token), 200);
    } catch (err) {
      if (isErr(err)) return c.json({ error: err.message }, err.statusCode);
      throw err;
    }
  },
);
