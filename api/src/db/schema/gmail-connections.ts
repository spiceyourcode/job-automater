import {
  index,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

/**
 * Gmail mailbox OAuth (P11.1). Refresh token is server-only (HG-1).
 * Never return token columns from list APIs; never log them (HG-8).
 */
export const gmailConnections = pgTable(
  "gmail_connections",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    gmailEmail: varchar("gmail_email", { length: 255 }).notNull(),
    /** Server-only. Never serialize to clients. */
    refreshToken: text("refresh_token").notNull(),
    accessToken: text("access_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at", {
      withTimezone: true,
    }),
    historyId: varchar("history_id", { length: 64 }),
    watchExpiration: timestamp("watch_expiration", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull()
      .$onUpdate(() => new Date()),
  },
  (table) => [
    uniqueIndex("uq_gmail_connections_user").on(table.userId),
    index("idx_gmail_connections_email").on(table.gmailEmail),
  ],
);

export type GmailConnection = typeof gmailConnections.$inferSelect;
export type NewGmailConnection = typeof gmailConnections.$inferInsert;
