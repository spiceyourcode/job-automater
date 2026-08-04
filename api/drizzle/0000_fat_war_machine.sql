CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"headline" varchar(500),
	"summary" text,
	"years_experience" integer,
	"current_role" varchar(255),
	"current_company" varchar(255),
	"technical_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"soft_skills" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"certifications" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_roles" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"preferred_locations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"salary_min" integer,
	"salary_max" integer,
	"salary_currency" varchar(3) DEFAULT 'USD' NOT NULL,
	"employment_types" jsonb DEFAULT '["full-time"]'::jsonb NOT NULL,
	"visa_status" varchar(50),
	"notice_period_weeks" integer,
	"willing_to_relocate" boolean DEFAULT false NOT NULL,
	"cv_file_id" uuid,
	"cv_version" integer DEFAULT 1 NOT NULL,
	"cv_last_indexed_at" timestamp with time zone,
	"auto_apply_enabled" boolean DEFAULT false NOT NULL,
	"max_applications_per_day" integer DEFAULT 10 NOT NULL,
	"min_match_score" integer DEFAULT 70 NOT NULL,
	"preferred_cv_template" varchar(50) DEFAULT 'modern' NOT NULL,
	"preferred_cl_template" varchar(50) DEFAULT 'standard' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" varchar(255) NOT NULL,
	"user_agent" text,
	"ip_address" "inet",
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"name" varchar(255),
	"avatar_url" text,
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"locale" varchar(10) DEFAULT 'en-US' NOT NULL,
	"password_hash" varchar(255),
	"google_id" varchar(255),
	"github_id" varchar(255),
	"linkedin_id" varchar(255),
	"failed_login_attempts" integer DEFAULT 0 NOT NULL,
	"locked_until" timestamp with time zone,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"deleted_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "profiles" ADD CONSTRAINT "profiles_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_profiles_user" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_user" ON "user_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_sessions_token" ON "user_sessions" USING btree ("token_hash");--> statement-breakpoint
CREATE INDEX "idx_sessions_expires" ON "user_sessions" USING btree ("expires_at") WHERE "user_sessions"."revoked_at" IS NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_email" ON "users" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_google_id" ON "users" USING btree ("google_id") WHERE "users"."google_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_github_id" ON "users" USING btree ("github_id") WHERE "users"."github_id" IS NOT NULL;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_users_linkedin_id" ON "users" USING btree ("linkedin_id") WHERE "users"."linkedin_id" IS NOT NULL;