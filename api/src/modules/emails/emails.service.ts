import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  emails,
  gmailConnections,
  notificationPreferences,
  notifications,
  DEFAULT_NOTIFICATION_PREFS,
} from "../../db/schema/index.js";
import { enqueueMonitorEmail } from "../../lib/queue.js";
import { env } from "../../env.js";
import {
  createOAuthState,
  pkcePair,
} from "../../lib/oauth.js";
import { saveOAuthState, takeOAuthState } from "../../lib/oauth-state.js";
import {
  buildGmailAuthorizeUrl,
  decodePushData,
  exchangeGmailCode,
  fetchGmailProfile,
  getGmailMessage,
  isGmailOAuthConfigured,
  listHistoryMessageIds,
  listRecentMessageIds,
  refreshGmailAccessToken,
  startGmailWatch,
} from "../../lib/gmail.js";
import type {
  ClassifyEmailBody,
  PatchNotificationPrefsBody,
  SyncEmailsBody,
} from "./emails.schema.js";

export class EmailsError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 401 | 403 | 404 | 503,
  ) {
    super(message);
    this.name = "EmailsError";
  }
}

/** Enqueue classifier — bodies never logged (HG-8). */
export async function syncEmails(userId: string, body: SyncEmailsBody) {
  try {
    await enqueueMonitorEmail({
      user_id: userId,
      messages: body.messages.map((m) => ({
        external_id: m.externalId,
        from_email: m.fromEmail,
        from_name: m.fromName,
        subject: m.subject,
        snippet: m.snippet,
        body_text: m.bodyText,
        received_at: m.receivedAt,
      })),
    });
  } catch {
    throw new EmailsError("Failed to enqueue email sync", 503);
  }
  return { status: "queued" as const, count: body.messages.length };
}

/** List classified emails without body_text (HG-8). */
export async function listEmails(userId: string) {
  const rows = await db
    .select({
      id: emails.id,
      applicationId: emails.applicationId,
      fromEmail: emails.fromEmail,
      fromName: emails.fromName,
      subject: emails.subject,
      snippet: emails.snippet,
      category: emails.category,
      confidence: emails.confidence,
      processed: emails.processed,
      needsManualReview: emails.needsManualReview,
      receivedAt: emails.receivedAt,
      classifiedAt: emails.classifiedAt,
    })
    .from(emails)
    .where(eq(emails.userId, userId))
    .orderBy(desc(emails.receivedAt))
    .limit(100);
  return { emails: rows };
}

export async function listReviewQueue(userId: string) {
  const rows = await db
    .select({
      id: emails.id,
      applicationId: emails.applicationId,
      fromEmail: emails.fromEmail,
      fromName: emails.fromName,
      subject: emails.subject,
      snippet: emails.snippet,
      category: emails.category,
      confidence: emails.confidence,
      needsManualReview: emails.needsManualReview,
      receivedAt: emails.receivedAt,
    })
    .from(emails)
    .where(and(eq(emails.userId, userId), eq(emails.needsManualReview, true)))
    .orderBy(desc(emails.receivedAt))
    .limit(100);
  return { emails: rows };
}

/**
 * User-corrected category. Never auto-updates application status (P11.3).
 */
export async function classifyEmail(
  userId: string,
  id: string,
  body: ClassifyEmailBody,
) {
  const [updated] = await db
    .update(emails)
    .set({
      category: body.category,
      needsManualReview: false,
      processed: true,
      processedAt: new Date(),
      classifiedAt: new Date(),
    })
    .where(and(eq(emails.id, id), eq(emails.userId, userId)))
    .returning({
      id: emails.id,
      category: emails.category,
      needsManualReview: emails.needsManualReview,
      applicationId: emails.applicationId,
    });
  if (!updated) throw new EmailsError("Email not found", 404);
  return {
    email: updated,
    applicationStatusUpdated: false as const,
  };
}

export async function listNotifications(userId: string) {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
  const unreadCount = rows.filter((n) => !n.isRead).length;
  return {
    unreadCount,
    notifications: rows.map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      message: n.message,
      data: n.data,
      isRead: n.isRead,
      priority: n.priority,
      createdAt: n.createdAt,
    })),
  };
}

export async function markAllNotificationsRead(userId: string) {
  const updated = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.userId, userId), eq(notifications.isRead, false)))
    .returning({ id: notifications.id });
  return { count: updated.length };
}

export async function getNotificationPreferences(userId: string) {
  const [row] = await db
    .select()
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);
  const preferences = {
    ...DEFAULT_NOTIFICATION_PREFS,
    ...(row?.preferences ?? {}),
  };
  return {
    preferences,
    slackConfigured: Boolean(row?.slackWebhookUrl),
    telegramConfigured: Boolean(row?.telegramWebhookUrl),
  };
}

export async function patchNotificationPreferences(
  userId: string,
  body: PatchNotificationPrefsBody,
) {
  const current = await getNotificationPreferences(userId);
  const preferences = body.preferences
    ? { ...current.preferences, ...body.preferences }
    : current.preferences;

  const [existing] = await db
    .select({
      id: notificationPreferences.id,
      slackWebhookUrl: notificationPreferences.slackWebhookUrl,
      telegramWebhookUrl: notificationPreferences.telegramWebhookUrl,
    })
    .from(notificationPreferences)
    .where(eq(notificationPreferences.userId, userId))
    .limit(1);

  const slack =
    body.slackWebhookUrl === undefined
      ? (existing?.slackWebhookUrl ?? null)
      : body.slackWebhookUrl;
  const telegram =
    body.telegramWebhookUrl === undefined
      ? (existing?.telegramWebhookUrl ?? null)
      : body.telegramWebhookUrl;

  if (existing) {
    await db
      .update(notificationPreferences)
      .set({
        preferences,
        slackWebhookUrl: slack,
        telegramWebhookUrl: telegram,
        updatedAt: new Date(),
      })
      .where(eq(notificationPreferences.userId, userId));
  } else {
    await db.insert(notificationPreferences).values({
      userId,
      preferences,
      slackWebhookUrl: slack,
      telegramWebhookUrl: telegram,
    });
  }
  return getNotificationPreferences(userId);
}

export async function markNotificationRead(userId: string, id: string) {
  const [updated] = await db
    .update(notifications)
    .set({ isRead: true, readAt: new Date() })
    .where(and(eq(notifications.id, id), eq(notifications.userId, userId)))
    .returning();
  if (!updated) throw new EmailsError("Notification not found", 404);
  return {
    notification: {
      id: updated.id,
      isRead: updated.isRead,
      readAt: updated.readAt,
    },
  };
}

function publicGmailStatus(row: {
  gmailEmail: string;
  historyId: string | null;
  watchExpiration: Date | null;
}) {
  return {
    connected: true as const,
    email: row.gmailEmail,
    historyId: row.historyId,
    watchExpiration: row.watchExpiration,
  };
}

export async function getGmailStatus(userId: string) {
  const [row] = await db
    .select({
      gmailEmail: gmailConnections.gmailEmail,
      historyId: gmailConnections.historyId,
      watchExpiration: gmailConnections.watchExpiration,
    })
    .from(gmailConnections)
    .where(eq(gmailConnections.userId, userId))
    .limit(1);
  if (!row) return { connected: false as const };
  return publicGmailStatus(row);
}

export async function startGmailOAuth(userId: string): Promise<{ url: string }> {
  if (!isGmailOAuthConfigured()) {
    throw new EmailsError("Gmail OAuth is not configured", 400);
  }
  const state = createOAuthState();
  const pkce = pkcePair();
  await saveOAuthState(state, {
    provider: "google",
    purpose: "gmail",
    userId,
    codeVerifier: pkce.verifier,
  });
  return { url: buildGmailAuthorizeUrl({ state, codeChallenge: pkce.challenge }) };
}

export async function completeGmailOAuth(params: {
  code: string;
  state: string;
}): Promise<{ ok: true }> {
  const saved = await takeOAuthState(params.state);
  if (!saved || saved.purpose !== "gmail" || !saved.userId || !saved.codeVerifier) {
    throw new EmailsError("Invalid Gmail OAuth state", 400);
  }
  const tokens = await exchangeGmailCode(params.code, saved.codeVerifier);
  if (!tokens.refreshToken) {
    throw new EmailsError("Gmail did not return a refresh token", 400);
  }
  const profile = await fetchGmailProfile(tokens.accessToken);
  const expires = new Date(Date.now() + tokens.expiresIn * 1000);

  let watchExpiration: Date | null = null;
  let historyId = profile.historyId ?? null;
  if (env.gmailPubsubTopic) {
    try {
      const watch = await startGmailWatch(tokens.accessToken, env.gmailPubsubTopic);
      if (watch.historyId) historyId = watch.historyId;
      if (watch.expirationMs) watchExpiration = new Date(watch.expirationMs);
    } catch {
      // Watch is optional when Pub/Sub topic is misconfigured; history sync still works.
    }
  }

  const [existing] = await db
    .select({ id: gmailConnections.id })
    .from(gmailConnections)
    .where(eq(gmailConnections.userId, saved.userId))
    .limit(1);

  if (existing) {
    await db
      .update(gmailConnections)
      .set({
        gmailEmail: profile.email,
        refreshToken: tokens.refreshToken,
        accessToken: tokens.accessToken,
        accessTokenExpiresAt: expires,
        historyId,
        watchExpiration,
        updatedAt: new Date(),
      })
      .where(eq(gmailConnections.userId, saved.userId));
  } else {
    await db.insert(gmailConnections).values({
      userId: saved.userId,
      gmailEmail: profile.email,
      refreshToken: tokens.refreshToken,
      accessToken: tokens.accessToken,
      accessTokenExpiresAt: expires,
      historyId,
      watchExpiration,
    });
  }
  return { ok: true };
}

async function accessTokenFor(userId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  historyId: string | null;
  gmailEmail: string;
}> {
  const [row] = await db
    .select()
    .from(gmailConnections)
    .where(eq(gmailConnections.userId, userId))
    .limit(1);
  if (!row) throw new EmailsError("Gmail is not connected", 404);
  const stillValid =
    row.accessToken &&
    row.accessTokenExpiresAt &&
    row.accessTokenExpiresAt.getTime() > Date.now() + 60_000;
  if (stillValid && row.accessToken) {
    return {
      accessToken: row.accessToken,
      refreshToken: row.refreshToken,
      historyId: row.historyId,
      gmailEmail: row.gmailEmail,
    };
  }
  const refreshed = await refreshGmailAccessToken(row.refreshToken);
  const expires = new Date(Date.now() + refreshed.expiresIn * 1000);
  await db
    .update(gmailConnections)
    .set({
      accessToken: refreshed.accessToken,
      accessTokenExpiresAt: expires,
      updatedAt: new Date(),
    })
    .where(eq(gmailConnections.userId, userId));
  return {
    accessToken: refreshed.accessToken,
    refreshToken: row.refreshToken,
    historyId: row.historyId,
    gmailEmail: row.gmailEmail,
  };
}

async function ingestMessageIds(
  userId: string,
  accessToken: string,
  ids: string[],
): Promise<number> {
  const messages = [];
  for (const id of ids.slice(0, 50)) {
    const msg = await getGmailMessage(accessToken, id);
    if (msg) messages.push(msg);
  }
  if (messages.length === 0) return 0;
  await enqueueMonitorEmail({
    user_id: userId,
    provider: "gmail",
    messages: messages.map((m) => ({
      external_id: m.externalId,
      from_email: m.fromEmail,
      from_name: m.fromName,
      subject: m.subject,
      snippet: m.snippet,
      body_text: m.bodyText,
      received_at: m.receivedAt,
    })),
  });
  return messages.length;
}

export async function syncGmailHistory(userId: string) {
  const creds = await accessTokenFor(userId);
  let ids: string[] = [];
  let latest = creds.historyId;
  if (creds.historyId) {
    const hist = await listHistoryMessageIds(creds.accessToken, creds.historyId);
    if (hist.expired) {
      const recent = await listRecentMessageIds(creds.accessToken);
      ids = recent.ids;
      latest = recent.historyId ?? latest;
    } else {
      ids = hist.ids;
      latest = hist.latestHistoryId ?? latest;
    }
  } else {
    const recent = await listRecentMessageIds(creds.accessToken);
    ids = recent.ids;
    latest = recent.historyId ?? latest;
  }
  const count = await ingestMessageIds(userId, creds.accessToken, ids);
  if (latest) {
    await db
      .update(gmailConnections)
      .set({ historyId: latest, updatedAt: new Date() })
      .where(eq(gmailConnections.userId, userId));
  }
  return { status: "queued" as const, count };
}

export async function renewGmailWatch(userId: string) {
  if (!env.gmailPubsubTopic) {
    throw new EmailsError("Gmail Pub/Sub topic is not configured", 400);
  }
  const creds = await accessTokenFor(userId);
  const watch = await startGmailWatch(creds.accessToken, env.gmailPubsubTopic);
  const watchExpiration = watch.expirationMs
    ? new Date(watch.expirationMs)
    : null;
  await db
    .update(gmailConnections)
    .set({
      historyId: watch.historyId ?? creds.historyId,
      watchExpiration,
      updatedAt: new Date(),
    })
    .where(eq(gmailConnections.userId, userId));
  return {
    ok: true as const,
    watchExpiration,
    historyId: watch.historyId ?? creds.historyId,
  };
}

export async function disconnectGmail(userId: string) {
  const deleted = await db
    .delete(gmailConnections)
    .where(eq(gmailConnections.userId, userId))
    .returning({ id: gmailConnections.id });
  if (deleted.length === 0) throw new EmailsError("Gmail is not connected", 404);
  return { connected: false as const };
}

/** Pub/Sub push — never logs payload body (HG-8). */
export async function handleGmailPush(raw: unknown, token?: string | null) {
  if (env.gmailPushToken && token !== env.gmailPushToken) {
    throw new EmailsError("unauthorized", 401);
  }
  const envelope = raw as {
    message?: { data?: string };
    emailAddress?: string;
    historyId?: string | number;
  };
  const decoded = envelope.message?.data
    ? decodePushData(envelope.message.data)
    : envelope;
  const emailAddress = decoded.emailAddress?.toLowerCase();
  if (!emailAddress) return { status: "ignored" as const, count: 0 };

  const [row] = await db
    .select({ userId: gmailConnections.userId })
    .from(gmailConnections)
    .where(eq(gmailConnections.gmailEmail, emailAddress))
    .limit(1);
  if (!row) return { status: "ignored" as const, count: 0 };
  return syncGmailHistory(row.userId);
}
