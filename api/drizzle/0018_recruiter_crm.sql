CREATE TABLE "recruiter_contacts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"name" varchar(200) NOT NULL,
	"company" varchar(255),
	"email" varchar(255),
	"role" varchar(200),
	"linkedin_url" text,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recruiter_interactions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"contact_id" uuid NOT NULL,
	"application_id" uuid,
	"kind" varchar(40) DEFAULT 'note' NOT NULL,
	"summary" text NOT NULL,
	"happened_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "recruiter_contacts" ADD CONSTRAINT "recruiter_contacts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recruiter_interactions" ADD CONSTRAINT "recruiter_interactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "recruiter_interactions" ADD CONSTRAINT "recruiter_interactions_contact_id_recruiter_contacts_id_fk" FOREIGN KEY ("contact_id") REFERENCES "public"."recruiter_contacts"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE INDEX "idx_recruiter_contacts_user" ON "recruiter_contacts" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX "idx_recruiter_interactions_user" ON "recruiter_interactions" USING btree ("user_id");
