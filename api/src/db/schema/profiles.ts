import {
  boolean,
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

/** Salary fields are integer USD cents (HG-3) — never float. */
export const profiles = pgTable(
  "profiles",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    headline: varchar("headline", { length: 500 }),
    summary: text("summary"),
    yearsExperience: integer("years_experience"),
    currentRole: varchar("current_role", { length: 255 }),
    currentCompany: varchar("current_company", { length: 255 }),
    technicalSkills: jsonb("technical_skills")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    softSkills: jsonb("soft_skills")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    certifications: jsonb("certifications")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    preferredRoles: jsonb("preferred_roles")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    preferredLocations: jsonb("preferred_locations")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    salaryMin: integer("salary_min"),
    salaryMax: integer("salary_max"),
    salaryCurrency: varchar("salary_currency", { length: 3 })
      .default("USD")
      .notNull(),
    employmentTypes: jsonb("employment_types")
      .$type<string[]>()
      .default(sql`'["full-time"]'::jsonb`)
      .notNull(),
    visaStatus: varchar("visa_status", { length: 50 }),
    noticePeriodWeeks: integer("notice_period_weeks"),
    willingToRelocate: boolean("willing_to_relocate").default(false).notNull(),
    cvFileId: uuid("cv_file_id"),
    cvVersion: integer("cv_version").default(1).notNull(),
    cvLastIndexedAt: timestamp("cv_last_indexed_at", { withTimezone: true }),
    autoApplyEnabled: boolean("auto_apply_enabled").default(false).notNull(),
    maxApplicationsPerDay: integer("max_applications_per_day")
      .default(10)
      .notNull(),
    minMatchScore: integer("min_match_score").default(70).notNull(),
    preferredCvTemplate: varchar("preferred_cv_template", { length: 50 })
      .default("modern")
      .notNull(),
    preferredClTemplate: varchar("preferred_cl_template", { length: 50 })
      .default("standard")
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [uniqueIndex("idx_profiles_user").on(table.userId)],
);

export type Profile = typeof profiles.$inferSelect;
export type NewProfile = typeof profiles.$inferInsert;
