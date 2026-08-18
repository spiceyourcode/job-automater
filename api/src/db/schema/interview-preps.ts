import {
  index,
  jsonb,
  pgTable,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";
import { applications } from "./applications.js";

export type InterviewQuestion = {
  question: string;
  suggestedAnswer: string;
  category: "behavioral" | "technical" | "company" | "negotiation";
  chunkIds: string[];
};

export type StarStory = {
  title: string;
  situation: string;
  task: string;
  action: string;
  result: string;
  chunkIds: string[];
};

export type NegotiationScript = {
  currency: string;
  rangeMinCents: number | null;
  rangeMaxCents: number | null;
  targetCents: number | null;
  walkawayCents: number | null;
  talkingPoints: string[];
  chunkIds: string[];
};

export const interviewPreps = pgTable(
  "interview_preps",
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
    questions: jsonb("questions")
      .$type<InterviewQuestion[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    starStories: jsonb("star_stories")
      .$type<StarStory[]>()
      .default(sql`'[]'::jsonb`)
      .notNull(),
    negotiation: jsonb("negotiation").$type<NegotiationScript | null>(),
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
    uniqueIndex("uq_interview_preps_user_app").on(
      table.userId,
      table.applicationId,
    ),
    index("idx_interview_preps_user").on(table.userId),
  ],
);

export type InterviewPrep = typeof interviewPreps.$inferSelect;
export type NewInterviewPrep = typeof interviewPreps.$inferInsert;
