import {
  index,
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
import { jobs } from "./jobs.js";

/** Per-user match scores — never cross-user (IDOR). Reasoning required (P2.4). */
export const jobScores = pgTable(
  "job_scores",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    jobId: uuid("job_id")
      .notNull()
      .references(() => jobs.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    overallScore: numeric("overall_score", { precision: 5, scale: 2 }).notNull(),
    skillMatch: numeric("skill_match", { precision: 5, scale: 2 }),
    experienceMatch: numeric("experience_match", { precision: 5, scale: 2 }),
    locationMatch: numeric("location_match", { precision: 5, scale: 2 }),
    salaryMatch: numeric("salary_match", { precision: 5, scale: 2 }),
    cultureMatch: numeric("culture_match", { precision: 5, scale: 2 }),
    keywordMatch: numeric("keyword_match", { precision: 5, scale: 2 }),
    seniorityMatch: numeric("seniority_match", { precision: 5, scale: 2 }),
    weights: jsonb("weights")
      .$type<Record<string, number>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    matchedSkills: jsonb("matched_skills")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    missingSkills: jsonb("missing_skills")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    niceToHaveSkills: jsonb("nice_to_have_skills")
      .$type<unknown[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    /** Required — scores without reasoning are rejected (P2.4 FAILURE). */
    reasoning: text("reasoning").notNull(),
    confidence: numeric("confidence", { precision: 3, scale: 2 }),
    modelUsed: varchar("model_used", { length: 50 }).default("heuristic-v1"),
    promptVersion: varchar("prompt_version", { length: 20 }),
    scoredAt: timestamp("scored_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uq_job_scores_job_user").on(table.jobId, table.userId),
    index("idx_scores_user_score").on(table.userId, table.overallScore),
    index("idx_scores_job_user").on(table.jobId, table.userId),
  ],
);

export type JobScore = typeof jobScores.$inferSelect;
export type NewJobScore = typeof jobScores.$inferInsert;
