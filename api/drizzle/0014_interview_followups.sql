ALTER TABLE "applications" ADD COLUMN "interview_stages" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "applications" ADD COLUMN "next_followup_at" timestamp with time zone;
ALTER TABLE "applications" ADD COLUMN "followup_count" integer DEFAULT 0 NOT NULL;
CREATE INDEX "idx_apps_followup" ON "applications" USING btree ("next_followup_at") WHERE "next_followup_at" IS NOT NULL;
CREATE INDEX "idx_apps_interviewing" ON "applications" USING btree ("user_id") WHERE "status" = 'interviewing';
