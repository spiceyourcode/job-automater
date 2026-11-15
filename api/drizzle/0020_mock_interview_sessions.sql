CREATE TABLE "mock_interview_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid NOT NULL,
	"status" varchar(20) DEFAULT 'active' NOT NULL,
	"turns" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"meta" jsonb NOT NULL,
	"model_used" varchar(80),
	"ended_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "mock_interview_sessions" ADD CONSTRAINT "mock_interview_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mock_interview_sessions" ADD CONSTRAINT "mock_interview_sessions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_mock_interview_sessions_user" ON "mock_interview_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_mock_interview_sessions_app" ON "mock_interview_sessions" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_mock_interview_sessions_user_app_status" ON "mock_interview_sessions" USING btree ("user_id","application_id","status");