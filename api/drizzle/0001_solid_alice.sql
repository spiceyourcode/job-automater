CREATE TABLE "cv_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"original_filename" varchar(255),
	"file_url" text NOT NULL,
	"file_hash" varchar(64) NOT NULL,
	"file_size" integer,
	"mime_type" varchar(100),
	"parsed_text" text,
	"parsed_sections" jsonb,
	"chunk_count" integer DEFAULT 0 NOT NULL,
	"last_chunked_at" timestamp with time zone,
	"embedding_model" varchar(50) DEFAULT 'text-embedding-3-large',
	"is_active" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cv_documents" ADD CONSTRAINT "cv_documents_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cv_documents_user_id_version_unique" ON "cv_documents" USING btree ("user_id","version");--> statement-breakpoint
CREATE INDEX "idx_cv_docs_user" ON "cv_documents" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_cv_docs_hash" ON "cv_documents" USING btree ("file_hash");