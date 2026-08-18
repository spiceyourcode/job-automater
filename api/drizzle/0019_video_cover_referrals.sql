ALTER TABLE "recruiter_contacts" ADD COLUMN "kind" varchar(40) DEFAULT 'recruiter' NOT NULL;
--> statement-breakpoint
CREATE TABLE "video_cover_scripts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"script" text,
	"hook" text,
	"close" text,
	"chunk_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"estimated_seconds" integer,
	"model_used" varchar(80),
	"error_code" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "video_cover_scripts" ADD CONSTRAINT "video_cover_scripts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "video_cover_scripts" ADD CONSTRAINT "video_cover_scripts_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_video_cover_scripts_user_app" ON "video_cover_scripts" USING btree ("user_id","application_id");
--> statement-breakpoint
CREATE INDEX "idx_video_cover_scripts_user" ON "video_cover_scripts" USING btree ("user_id");
