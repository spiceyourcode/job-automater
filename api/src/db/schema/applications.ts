import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";
import { jobs } from "./jobs.js";

/**
 * Application drafts — status stays `draft` until user reviews (P3)
 * and approves (P4 / HG-4).
 */
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    cvVersion: integer("cv_version").notNull().default(1),
    cvTemplate: varchar("cv_template", { length: 50 }).default("modern"),
    clTemplate: varchar("cl_template", { length: 50 }).default("standard"),
    tailoredCvUrl: text("tailored_cv_url"),
    tailoredCvContent: text("tailored_cv_content"),
    coverLetterUrl: text("cover_letter_url"),
    coverLetterContent: text("cover_letter_text"),
    /** Every generated bullet must list a cv_chunks id (HG-9). */
    bulletTraces: jsonb("bullet_traces")
      .$type<
        Array<{
          text: string;
          chunkId?: string;
          chunk_id?: string;
          section: string;
          status?: "accepted" | "rejected" | "pending";
        }>
      >()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    generationModel: varchar("generation_model", { length: 50 }),
    generationDurationMs: integer("generation_duration_ms"),
    status: varchar("status", { length: 30 }).default("draft").notNull(),
    /** Set when user completes side-by-side review (P3.2). */
    documentsReviewedAt: timestamp("documents_reviewed_at", {
      withTimezone: true,
    }),
    submittedVia: varchar("submitted_via", { length: 50 }),
    externalApplicationId: varchar("external_application_id", { length: 255 }),
    /** MinIO key for confirmation screenshot (P4.2 — required on submit). */
    confirmationScreenshotUrl: text("confirmation_screenshot_url"),
    submittedAt: timestamp("submitted_at", { withTimezone: true }),
    approvedAt: timestamp("approved_at", { withTimezone: true }),
    userNotes: text("user_notes"),
    submitError: varchar("submit_error", { length: 100 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_apps_user_status").on(table.userId, table.status),
    index("idx_apps_job_user").on(table.jobId, table.userId),
    uniqueIndex("uq_apps_user_job_draft").on(table.userId, table.jobId),
  ],
);

export type Application = typeof applications.$inferSelect;
export type NewApplication = typeof applications.$inferInsert;
