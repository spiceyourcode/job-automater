CREATE TABLE "applications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"cv_version" integer DEFAULT 1 NOT NULL,
	"cv_template" varchar(50) DEFAULT 'modern',
	"cl_template" varchar(50) DEFAULT 'standard',
	"tailored_cv_url" text,
	"tailored_cv_content" text,
	"cover_letter_url" text,
	"cover_letter_text" text,
	"bullet_traces" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"generation_model" varchar(50),
	"generation_duration_ms" integer,
	"status" varchar(30) DEFAULT 'draft' NOT NULL,
	"documents_reviewed_at" timestamp with time zone,
	"submitted_via" varchar(50),
	"external_application_id" varchar(255),
	"submitted_at" timestamp with time zone,
	"approved_at" timestamp with time zone,
	"user_notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_job_id_jobs_id_fk" FOREIGN KEY ("job_id") REFERENCES "public"."jobs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_apps_user_status" ON "applications" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_apps_job_user" ON "applications" USING btree ("job_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_apps_user_job_draft" ON "applications" USING btree ("user_id","job_id");