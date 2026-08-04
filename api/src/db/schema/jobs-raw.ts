import {
  boolean,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { sourceConfigs } from "./source-configs.js";

/** Staging table for collector output — normalize in P2.3. */
export const jobsRaw = pgTable(
  "jobs_raw",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceConfigId: uuid("source_config_id").references(() => sourceConfigs.id, {
      onDelete: "set null",
    }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    sourceId: varchar("source_id", { length: 255 }),
    sourceUrl: text("source_url"),
    rawData: jsonb("raw_data").$type<Record<string, unknown>>().notNull(),
    collectedAt: timestamp("collected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    processed: boolean("processed").default(false).notNull(),
    processedAt: timestamp("processed_at", { withTimezone: true }),
    processingError: text("processing_error"),
    dedupHash: varchar("dedup_hash", { length: 64 }),
    isDuplicate: boolean("is_duplicate").default(false).notNull(),
    duplicateOf: uuid("duplicate_of"),
  },
  (table) => [
    index("idx_jobs_raw_source").on(table.sourceConfigId, table.processed),
    index("idx_jobs_raw_user").on(table.userId, table.collectedAt),
    index("idx_jobs_raw_dedup").on(table.dedupHash),
    uniqueIndex("uq_jobs_raw_source_external").on(
      table.sourceConfigId,
      table.sourceId,
    ),
  ],
);

export type JobRaw = typeof jobsRaw.$inferSelect;
export type NewJobRaw = typeof jobsRaw.$inferInsert;
