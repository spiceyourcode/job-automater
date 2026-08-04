import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
  varchar,
  customType,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { users } from "./users.js";
import { cvDocuments } from "./cv-documents.js";

/** pgvector embedding — 1536 dims (text-embedding-3-large). */
const vector1536 = customType<{ data: number[]; driverData: string }>({
  dataType() {
    return "vector(1536)";
  },
  toDriver(value: number[]): string {
    return `[${value.join(",")}]`;
  },
  fromDriver(value: string): number[] {
    const inner = value.replace(/^\[|\]$/g, "");
    if (!inner) return [];
    return inner.split(",").map((x) => Number(x.trim()));
  },
});

export const cvChunks = pgTable(
  "cv_chunks",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    cvDocumentId: uuid("cv_document_id")
      .notNull()
      .references(() => cvDocuments.id, { onDelete: "cascade" }),
    userId: uuid("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    chunkIndex: integer("chunk_index").notNull(),
    content: text("content").notNull(),
    tokenCount: integer("token_count"),
    sectionType: varchar("section_type", { length: 50 }),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .default(sql`'{}'::jsonb`)
      .notNull(),
    embedding: vector1536("embedding"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (table) => [
    uniqueIndex("uq_cv_chunks_doc_index").on(table.cvDocumentId, table.chunkIndex),
    index("idx_cv_chunks_user").on(table.userId),
    index("idx_cv_chunks_doc").on(table.cvDocumentId),
  ],
);

export type CvChunk = typeof cvChunks.$inferSelect;
export type NewCvChunk = typeof cvChunks.$inferInsert;
