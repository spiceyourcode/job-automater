CREATE TABLE "emails" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"application_id" uuid,
	"provider" varchar(30) DEFAULT 'imap' NOT NULL,
	"external_id" varchar(255) NOT NULL,
	"thread_id" varchar(255),
	"from_email" varchar(255) NOT NULL,
	"from_name" varchar(255),
	"subject" varchar(500),
	"snippet" text,
	"body_text" text,
	"received_at" timestamp with time zone NOT NULL,
	"category" varchar(50),
	"confidence" numeric(3, 2),
	"classified_at" timestamp with time zone,
	"classifier_version" varchar(20),
	"extracted_data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"processed" boolean DEFAULT false NOT NULL,
	"processed_at" timestamp with time zone,
	"processing_error" text,
	"needs_manual_review" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(255) NOT NULL,
	"message" text,
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"channels" jsonb DEFAULT '["in_app"]'::jsonb NOT NULL,
	"is_read" boolean DEFAULT false NOT NULL,
	"read_at" timestamp with time zone,
	"priority" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emails" ADD CONSTRAINT "emails_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_emails_user_external" ON "emails" USING btree ("user_id","external_id");--> statement-breakpoint
CREATE INDEX "idx_emails_user_received" ON "emails" USING btree ("user_id","received_at");--> statement-breakpoint
CREATE INDEX "idx_emails_application" ON "emails" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "idx_emails_unprocessed" ON "emails" USING btree ("user_id","received_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_unread" ON "notifications" USING btree ("user_id","is_read","created_at");--> statement-breakpoint
CREATE INDEX "idx_notifications_user_recent" ON "notifications" USING btree ("user_id","created_at");