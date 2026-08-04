CREATE TABLE "jobs_raw" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_config_id" uuid,
	"user_id" uuid NOT NULL,
	"source_id" varchar(255),
	"source_url" text,
	"raw_data" jsonb NOT NULL,
	"collected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	"dedup_hash" varchar(64),
	"is_duplicate" boolean DEFAULT false NOT NULL,
	"duplicate_of" uuid
);
--> statement-breakpoint
ALTER TABLE "jobs_raw" ADD CONSTRAINT "jobs_raw_source_config_id_source_configs_id_fk" FOREIGN KEY ("source_config_id") REFERENCES "public"."source_configs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "jobs_raw" ADD CONSTRAINT "jobs_raw_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_jobs_raw_source" ON "jobs_raw" USING btree ("source_config_id","processed");--> statement-breakpoint
CREATE INDEX "idx_jobs_raw_user" ON "jobs_raw" USING btree ("user_id","collected_at");--> statement-breakpoint
CREATE INDEX "idx_jobs_raw_dedup" ON "jobs_raw" USING btree ("dedup_hash");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_jobs_raw_source_external" ON "jobs_raw" USING btree ("source_config_id","source_id");