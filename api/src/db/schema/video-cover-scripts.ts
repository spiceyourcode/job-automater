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
import { applications } from "./applications.js";

export const videoCoverScripts = pgTable(
  "video_cover_scripts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id")
      .notNull()
      .references(() => applications.id, { onDelete: "cascade" }),
    jobId: uuid("job_id").notNull(),
    status: varchar("status", { length: 30 }).notNull().default("pending"),
    script: text("script"),
    hook: text("hook"),
    close: text("close"),
    chunkIds: jsonb("chunk_ids")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    estimatedSeconds: integer("estimated_seconds"),
    modelUsed: varchar("model_used", { length: 80 }),
    errorCode: varchar("error_code", { length: 80 }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uq_video_cover_scripts_user_app").on(
      table.userId,
      table.applicationId,
    ),
    index("idx_video_cover_scripts_user").on(table.userId),
  ],
);

export type VideoCoverScript = typeof videoCoverScripts.$inferSelect;
export type NewVideoCoverScript = typeof videoCoverScripts.$inferInsert;
