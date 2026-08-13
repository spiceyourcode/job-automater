import {
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { sourceConfigs } from "./source-configs.js";

/** Per-source collect run history — P8.5 GET /sources/:id/runs. */
export const sourceRuns = pgTable(
  "source_runs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sourceConfigId: uuid("source_config_id")
      .notNull()
      .references(() => sourceConfigs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 30 }).notNull(),
    jobsFound: integer("jobs_found").default(0).notNull(),
    durationMs: integer("duration_ms"),
    error: text("error"),
    startedAt: timestamp("started_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    completedAt: timestamp("completed_at", { withTimezone: true }),
  },
  (table) => [
    index("idx_source_runs_source").on(table.sourceConfigId, table.startedAt),
    index("idx_source_runs_user").on(table.userId, table.startedAt),
  ],
);

export type SourceRun = typeof sourceRuns.$inferSelect;
export type NewSourceRun = typeof sourceRuns.$inferInsert;
