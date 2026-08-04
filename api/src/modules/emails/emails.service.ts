import { and, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { emails, notifications } from "../../db/schema/index.js";
import { enqueueMonitorEmail } from "../../lib/queue.js";
import type { SyncEmailsBody } from "./emails.schema.js";

export class EmailsError extends Error {
  constructor(
    message: string,
    readonly statusCode: 400 | 403 | 404 | 503,
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

export async function listNotifications(userId: string) {
  const rows = await db
    .select()
    .from(notifications)
    .where(eq(notifications.userId, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50);
  return {
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
