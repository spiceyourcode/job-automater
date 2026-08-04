import {
  boolean,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";
import { applications } from "./applications.js";

/** Inbound recruiter/ATS emails — never log body_text (HG-8). */
export const emails = pgTable(
  "emails",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id, {
      onDelete: "set null",
    }),
    provider: varchar("provider", { length: 30 }).default("imap").notNull(),
    externalId: varchar("external_id", { length: 255 }).notNull(),
    threadId: varchar("thread_id", { length: 255 }),
    fromEmail: varchar("from_email", { length: 255 }).notNull(),
    fromName: varchar("from_name", { length: 255 }),
    subject: varchar("subject", { length: 500 }),
    snippet: text("snippet"),
    /** Stored for classifier only — never write to application logs (HG-8). */
    bodyText: text("body_text"),
    receivedAt: timestamp("received_at", { withTimezone: true }).notNull(),
    category: varchar("category", { length: 50 }),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    classifiedAt: timestamp("classified_at", { withTimezone: true }),
    classifierVersion: varchar("classifier_version", { length: 20 }),
    extractedData: jsonb("extracted_data")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    processed: boolean("processed").default(false).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingError: text("processing_error"),
    needsManualReview: boolean("needs_manual_review").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uq_emails_user_external").on(table.userId, table.externalId),
    index("idx_emails_user_received").on(table.userId, table.receivedAt),
    index("idx_emails_application").on(table.applicationId),
    index("idx_emails_unprocessed").on(table.userId, table.receivedAt),
  ],
);

export type Email = typeof emails.$inferSelect;
export type NewEmail = typeof emails.$inferInsert;

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 50 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    message: text("message"),
    data: jsonb("data")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    channels: jsonb("channels")
      .$type<string[]>()
      .default(sql`'["in_app"]'::jsonb`)
      .notNull(),
    isRead: boolean("is_read").default(false).notNull(),
    readAt: timestamp("read_at", { withTimezone: true }),
    priority: integer("priority").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    index("idx_notifications_user_unread").on(
      table.userId,
      table.isRead,
      table.createdAt,
    ),
    index("idx_notifications_user_recent").on(table.userId, table.createdAt),
  ],
);

export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
