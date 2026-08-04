CREATE TABLE "source_configs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"source_type" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"config" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"schedule_cron" varchar(100),
	"timezone" varchar(50) DEFAULT 'UTC' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"rate_limit_per_minute" integer DEFAULT 30 NOT NULL,
	"rate_limit_per_hour" integer DEFAULT 500 NOT NULL,
	"concurrent_limit" integer DEFAULT 3 NOT NULL,
	"keyword_filters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"location_filters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"company_filters" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"salary_min" integer,
	"experience_levels" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"last_run_at" timestamp with time zone,
	"last_run_status" varchar(30),
	"last_run_jobs_found" integer,
	"last_run_duration_ms" integer,
	"last_error" text,
	"consecutive_failures" integer DEFAULT 0 NOT NULL,
	"total_jobs_collected" bigint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_configs" ADD CONSTRAINT "source_configs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_sources_user" ON "source_configs" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "idx_sources_next_run" ON "source_configs" USING btree ("is_active","schedule_cron");