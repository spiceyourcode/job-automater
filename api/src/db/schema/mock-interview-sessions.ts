import { index, jsonb, pgTable, timestamp, uuid, varchar, } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";
import { applications } from "./applications.js";
export type MockInterviewTurn = {
    role: "user" | "assistant";
    content: string;
    createdAt: string;
};
export type MockInterviewMeta = {
    jobTitle: string;
    company: string;
    prepId: string;
};

export type MockInterviewSummary = {
    strengths: string[];
    improvements: string[];
    rubric: {
        clarity: number;
        relevance: number;
        structure: number;
        roleFit: number;
    };
    closingNote: string;
};
export const mockInterviewSessions = pgTable("mock_interview_sessions", {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id")
        .notNull()
        .references(() => applications.id, { onDelete: "cascade" }),
    status: varchar("status", { length: 20 }).notNull().default("active"),
    turns: jsonb("turns")
        .$type<MockInterviewTurn[]>()
        .default(sql `'[]'::jsonb`)
        .notNull(),
    meta: jsonb("meta").$type<MockInterviewMeta>().notNull(),
    summary: jsonb("summary").$type<MockInterviewSummary | null>(),
    modelUsed: varchar("model_used", { length: 80 }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
        .defaultNow()
        .notNull(),
}, (table) => [
    index("idx_mock_interview_sessions_user").on(table.userId),
    index("idx_mock_interview_sessions_app").on(table.applicationId),
    index("idx_mock_interview_sessions_user_app_status").on(table.userId, table.applicationId, table.status),
]);
export type MockInterviewSession = typeof mockInterviewSessions.$inferSelect;
export type NewMockInterviewSession = typeof mockInterviewSessions.$inferInsert;
