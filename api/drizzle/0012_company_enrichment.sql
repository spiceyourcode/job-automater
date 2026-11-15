ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "company_size" varchar(30);

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "company_industry" varchar(100);

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "company_domain" varchar(255);

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "company_logo_url" text;

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "company_description" text;

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "company_founded_year" integer;

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "company_employee_count" integer;

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "company_funding_stage" varchar(30);

ALTER TABLE "jobs" ADD COLUMN IF NOT EXISTS "company_tech_stack" jsonb DEFAULT '[]'::jsonb NOT NULL;
