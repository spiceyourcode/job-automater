import {
  bigint,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";
import { workspaces } from "./workspaces.js";

export const sourceConfigs = pgTable(
  "source_configs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    /** Shared within team — Owner CRUD; Member read (P6.1). */
    workspaceId: uuid("workspace_id").references(() => workspaces.id, {
      onDelete: "cascade",
    }),
    sourceType: varchar("source_type", { length: 50 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    config: jsonb("config")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    scheduleCron: varchar("schedule_cron", { length: 100 }),
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),
    isActive: boolean("is_active").default(true).notNull(),
    rateLimitPerMinute: integer("rate_limit_per_minute").default(30).notNull(),
    rateLimitPerHour: integer("rate_limit_per_hour").default(500).notNull(),
    concurrentLimit: integer("concurrent_limit").default(3).notNull(),
    keywordFilters: jsonb("keyword_filters")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    locationFilters: jsonb("location_filters")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    companyFilters: jsonb("company_filters")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    salaryMin: integer("salary_min"),
    experienceLevels: jsonb("experience_levels")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    lastRunAt: timestamp("last_run_at", { withTimezone: true }),
    lastRunStatus: varchar("last_run_status", { length: 30 }),
    lastRunJobsFound: integer("last_run_jobs_found"),
    lastRunDurationMs: integer("last_run_duration_ms"),
    lastError: text("last_error"),
    consecutiveFailures: integer("consecutive_failures").default(0).notNull(),
    totalJobsCollected: bigint("total_jobs_collected", { mode: "number" })
      .default(0)
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_sources_user").on(table.userId, table.isActive),
    index("idx_sources_next_run").on(table.isActive, table.scheduleCron),
  ],
);

export type SourceConfig = typeof sourceConfigs.$inferSelect;
export type NewSourceConfig = typeof sourceConfigs.$inferInsert;
