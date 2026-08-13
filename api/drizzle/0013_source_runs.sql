CREATE TABLE "source_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"source_config_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"status" varchar(30) NOT NULL,
	"jobs_found" integer DEFAULT 0 NOT NULL,
	"duration_ms" integer,
	"error" text,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_source_config_id_source_configs_id_fk" FOREIGN KEY ("source_config_id") REFERENCES "public"."source_configs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "source_runs" ADD CONSTRAINT "source_runs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_source_runs_source" ON "source_runs" USING btree ("source_config_id","started_at");--> statement-breakpoint
CREATE INDEX "idx_source_runs_user" ON "source_runs" USING btree ("user_id","started_at");
