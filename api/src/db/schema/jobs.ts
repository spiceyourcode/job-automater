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
import { sourceConfigs } from "./source-configs.js";

/** Normalized jobs — written only after Pydantic validation (P2.3 / HG-9). */
export const jobs = pgTable(
  "jobs",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id").references(() => users.id, { onDelete: "cascade" }),
    source: varchar("source", { length: 50 }).notNull(),
    sourceId: varchar("source_id", { length: 255 }),
    sourceUrl: text("source_url"),
    sourceConfigId: uuid("source_config_id").references(() => sourceConfigs.id, {
      onDelete: "set null",
    }),
    jobsRawId: uuid("jobs_raw_id"),
    collectedAt: timestamp("collected_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    company: varchar("company", { length: 255 }).notNull(),
    title: varchar("title", { length: 500 }).notNull(),
    location: varchar("location", { length: 255 }),
    isRemote: boolean("is_remote").default(false).notNull(),
    remoteType: varchar("remote_type", { length: 30 }),
    employmentType: varchar("employment_type", { length: 50 }),
    experienceLevel: varchar("experience_level", { length: 30 }),
    /** Salary in integer cents (HG-3). */
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryCurrency: varchar("salary_currency", { length: 3 }).default("USD"),
    salaryPeriod: varchar("salary_period", { length: 20 }).default("yearly"),
    description: text("description"),
    requirements: text("requirements"),
    responsibilities: text("responsibilities"),
    benefits: text("benefits"),
    niceToHave: text("nice_to_have"),
    postedAt: timestamp("posted_at", { withTimezone: true }),
    applicationUrl: text("application_url"),
    applicationEmail: varchar("application_email", { length: 255 }),
    applicationMethod: varchar("application_method", { length: 30 }),
    tags: jsonb("tags").$type<string[]>().default(sql`'[]'::jsonb`).notNull(),
    techStack: jsonb("tech_stack")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    keywords: jsonb("keywords")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    /** Per-field extraction confidence 0–1 (P2.3). */
    fieldConfidence: jsonb("field_confidence")
      .$type<Record<string, number>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    qualityScore: numeric("quality_score", { precision: 4, scale: 1 }),
    completenessScore: numeric("completeness_score", { precision: 4, scale: 1 }),
    /** Optional company enrichment (FR-NE-03 / P8.4). */
    companySize: varchar("company_size", { length: 30 }),
    companyIndustry: varchar("company_industry", { length: 100 }),
    companyDomain: varchar("company_domain", { length: 255 }),
    companyLogoUrl: text("company_logo_url"),
    companyDescription: text("company_description"),
    companyFoundedYear: integer("company_founded_year"),
    companyEmployeeCount: integer("company_employee_count"),
    companyFundingStage: varchar("company_funding_stage", { length: 30 }),
    companyTechStack: jsonb("company_tech_stack")
      .$type<string[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    status: varchar("status", { length: 30 }).default("new").notNull(),
    isDuplicate: boolean("is_duplicate").default(false).notNull(),
    duplicateOf: uuid("duplicate_of"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    index("idx_jobs_user_status").on(table.userId, table.status),
    index("idx_jobs_source_collected").on(table.source, table.collectedAt),
    index("idx_jobs_location_remote").on(table.location, table.isRemote),
    uniqueIndex("uq_jobs_user_source_external").on(
      table.userId,
      table.source,
      table.sourceId,
    ),
  ],
);

export type Job = typeof jobs.$inferSelect;
export type NewJob = typeof jobs.$inferInsert;
