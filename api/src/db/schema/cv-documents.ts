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
  index,
} from "drizzle-orm/pg-core";
import { users } from "./users.js";

export const cvDocuments = pgTable(
  "cv_documents",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    version: integer("version").notNull(),
    originalFilename: varchar("original_filename", { length: 255 }),
    fileUrl: text("file_url").notNull(),
    fileHash: varchar("file_hash", { length: 64 }).notNull(),
    fileSize: integer("file_size"),
    mimeType: varchar("mime_type", { length: 100 }),
    parsedText: text("parsed_text"),
    parsedSections: jsonb("parsed_sections").$type<Record<string, unknown>>(),
    chunkCount: integer("chunk_count").default(0).notNull(),
    lastChunkedAt: timestamp("last_chunked_at", { withTimezone: true }),
    embeddingModel: varchar("embedding_model", { length: 50 }).default(
      "text-embedding-3-large",
    ),
    isActive: boolean("is_active").default(false).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("cv_documents_user_id_version_unique").on(
      table.userId,
      table.version,
    ),
    index("idx_cv_docs_user").on(table.userId, table.isActive),
    index("idx_cv_docs_hash").on(table.fileHash),
  ],
);

export type CvDocument = typeof cvDocuments.$inferSelect;
export type NewCvDocument = typeof cvDocuments.$inferInsert;
