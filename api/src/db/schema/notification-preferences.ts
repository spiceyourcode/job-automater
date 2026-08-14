import {
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";

export type ChannelPref = {
  inApp: boolean;
  email: boolean;
  slack: boolean;
  telegram: boolean;
};

export const DEFAULT_NOTIFICATION_PREFS: Record<string, ChannelPref> = {
  high_match: { inApp: true, email: true, slack: false, telegram: false },
  interview_invitation: { inApp: true, email: true, slack: false, telegram: false },
  offer: { inApp: true, email: true, slack: false, telegram: false },
  rejection: { inApp: true, email: false, slack: false, telegram: false },
  docs_ready: { inApp: true, email: false, slack: false, telegram: false },
  application_confirmation: {
    inApp: true,
    email: false,
    slack: false,
    telegram: false,
  },
};

export const notificationPreferences = pgTable(
  "notification_preferences",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    preferences: jsonb("preferences")
      .$type<Record<string, ChannelPref>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    /** Server-only secrets — never log, redact in GET (HG-8). */
    slackWebhookUrl: text("slack_webhook_url"),
    telegramWebhookUrl: text("telegram_webhook_url"),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("uq_notification_prefs_user").on(table.userId)],
);

export type NotificationPreference = typeof notificationPreferences.$inferSelect;
export type NewNotificationPreference =
  typeof notificationPreferences.$inferInsert;
