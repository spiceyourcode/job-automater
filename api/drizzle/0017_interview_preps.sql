CREATE TABLE "interview_preps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"job_id" uuid NOT NULL,
	"status" varchar(30) DEFAULT 'pending' NOT NULL,
	"questions" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"star_stories" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"negotiation" jsonb,
	"model_used" varchar(80),
	"error_code" varchar(80),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "interview_preps" ADD CONSTRAINT "interview_preps_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "interview_preps" ADD CONSTRAINT "interview_preps_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "uq_interview_preps_user_app" ON "interview_preps" USING btree ("user_id","application_id");
--> statement-breakpoint
CREATE INDEX "idx_interview_preps_user" ON "interview_preps" USING btree ("user_id");
