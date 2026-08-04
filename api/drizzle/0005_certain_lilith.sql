CREATE EXTENSION IF NOT EXISTS vector;
--> statement-breakpoint
CREATE TABLE "cv_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"cv_document_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"content" text NOT NULL,
	"token_count" integer,
	"section_type" varchar(50),
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"embedding" vector(1536),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "job_scores" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"job_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"overall_score" numeric(5, 2) NOT NULL,
	"skill_match" numeric(5, 2),
	"experience_match" numeric(5, 2),
	"location_match" numeric(5, 2),
	"salary_match" numeric(5, 2),
	"culture_match" numeric(5, 2),
	"keyword_match" numeric(5, 2),
	"seniority_match" numeric(5, 2),
	"weights" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"matched_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"missing_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"nice_to_have_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"reasoning" text NOT NULL,
	"confidence" numeric(3, 2),
	"model_used" varchar(50) DEFAULT 'heuristic-v1',
	"prompt_version" varchar(20),
	"scored_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cv_chunks" ADD CONSTRAINT "cv_chunks_cv_document_id_cv_documents_id_fk" FOREIGN KEY ("cv_document_id") REFERENCES "public"."cv_documents"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cv_chunks" ADD CONSTRAINT "cv_chunks_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_scores" ADD CONSTRAINT "job_scores_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "job_scores" ADD CONSTRAINT "job_scores_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_cv_chunks_doc_index" ON "cv_chunks" USING btree ("cv_document_id","chunk_index");--> statement-breakpoint
CREATE INDEX "idx_cv_chunks_user" ON "cv_chunks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_cv_chunks_doc" ON "cv_chunks" USING btree ("cv_document_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_job_scores_job_user" ON "job_scores" USING btree ("job_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_scores_user_score" ON "job_scores" USING btree ("user_id","overall_score");--> statement-breakpoint
CREATE INDEX "idx_scores_job_user" ON "job_scores" USING btree ("job_id","user_id");