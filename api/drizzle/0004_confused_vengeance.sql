CREATE TABLE "jobs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"source" varchar(50) NOT NULL,
	"source_id" varchar(255),
	"source_url" text,
	"source_config_id" uuid,
	"jobs_raw_id" uuid,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"company" varchar(255) NOT NULL,
	"title" varchar(500) NOT NULL,
	"location" varchar(255),
	"is_remote" boolean DEFAULT false NOT NULL,
	"remote_type" varchar(30),
	"employment_type" varchar(50),
	"experience_level" varchar(30),
	"salary_min" integer,
	"salary_max" integer,
	"salary_currency" varchar(3) DEFAULT 'USD',
	"salary_period" varchar(20) DEFAULT 'yearly',
	"description" text,
	"requirements" text,
	"responsibilities" text,
	"benefits" text,
	"nice_to_have" text,
	"posted_at" timestamp with time zone,
	"application_url" text,
	"application_email" varchar(255),
	"application_method" varchar(30),
	"tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"tech_stack" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"keywords" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"field_confidence" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"quality_score" numeric(4, 1),
	"completeness_score" numeric(4, 1),
	"status" varchar(30) DEFAULT 'new' NOT NULL,
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"duplicate_of" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_source_config_id_source_configs_id_fk" FOREIGN KEY ("source_config_id") REFERENCES "public"."source_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_jobs_user_status" ON "jobs" USING btree ("user_id","status");--> statement-breakpoint
CREATE INDEX "idx_jobs_source_collected" ON "jobs" USING btree ("source","collected_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_location_remote" ON "jobs" USING btree ("location","is_remote");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_jobs_user_source_external" ON "jobs" USING btree ("user_id","source","source_id");