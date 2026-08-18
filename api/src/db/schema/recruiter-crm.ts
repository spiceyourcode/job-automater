import {
  index,
  pgTable,
  text,
  timestamp,
  uuid,
  varchar,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";
import { applications } from "./applications.js";

export const recruiterContacts = pgTable(
  "recruiter_contacts",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    name: varchar("name", { length: 200 }).notNull(),
    company: varchar("company", { length: 255 }),
    email: varchar("email", { length: 255 }),
    role: varchar("role", { length: 200 }),
    linkedinUrl: text("linkedin_url"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_recruiter_contacts_user").on(table.userId)],
);

export const recruiterInteractions = pgTable(
  "recruiter_interactions",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    contactId: uuid("contact_id")
      .notNull()
      .references(() => recruiterContacts.id, { onDelete: "cascade" }),
    applicationId: uuid("application_id").references(() => applications.id, {
      onDelete: "set null",
    }),
    kind: varchar("kind", { length: 40 }).notNull().default("note"),
    summary: text("summary").notNull(),
    happenedAt: timestamp("happened_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [index("idx_recruiter_interactions_user").on(table.userId)],
);

export type RecruiterContact = typeof recruiterContacts.$inferSelect;
export type RecruiterInteraction = typeof recruiterInteractions.$inferSelect;
