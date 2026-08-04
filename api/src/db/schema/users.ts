import { sql } from "drizzle-orm";
import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";

export const users = pgTable(
  "users",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    email: varchar("email", { length: 255 }).notNull(),
    emailVerified: boolean("email_verified").default(false).notNull(),
    name: varchar("name", { length: 255 }),
    avatarUrl: text("avatar_url"),
    timezone: varchar("timezone", { length: 50 }).default("UTC").notNull(),
    locale: varchar("locale", { length: 10 }).default("en-US").notNull(),
    passwordHash: varchar("password_hash", { length: 255 }),
    googleId: varchar("google_id", { length: 255 }),
    githubId: varchar("github_id", { length: 255 }),
    linkedinId: varchar("linkedin_id", { length: 255 }),
    failedLoginAttempts: integer("failed_login_attempts").default(0).notNull(),
    lockedUntil: timestamp("locked_until", { withTimezone: true }),
    lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
    deletedAt: timestamp("deleted_at", { withTimezone: true }),
  },
  (table) => [
    uniqueIndex("idx_users_email").on(table.email),
    uniqueIndex("idx_users_google_id")
      .on(table.googleId)
      .where(sql`${table.googleId} IS NOT NULL`),
    uniqueIndex("idx_users_github_id")
      .on(table.githubId)
      .where(sql`${table.githubId} IS NOT NULL`),
    uniqueIndex("idx_users_linkedin_id")
      .on(table.linkedinId)
      .where(sql`${table.linkedinId} IS NOT NULL`),
  ],
);

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
