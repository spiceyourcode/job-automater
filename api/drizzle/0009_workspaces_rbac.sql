CREATE TABLE "workspace_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"workspace_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(20) DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"owner_user_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "source_configs" ADD COLUMN "workspace_id" uuid;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_members" ADD CONSTRAINT "workspace_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_owner_user_id_users_id_fk" FOREIGN KEY ("owner_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "uq_workspace_members_user" ON "workspace_members" USING btree ("workspace_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_workspace_members_user" ON "workspace_members" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "source_configs" ADD CONSTRAINT "source_configs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
-- Backfill: personal workspace per existing user + owner membership + link sources
INSERT INTO "workspaces" ("id", "name", "owner_user_id")
SELECT gen_random_uuid(), COALESCE(split_part(u.email, '@', 1), 'Workspace') || '''s workspace', u.id
FROM "users" u
WHERE u.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "workspaces" w WHERE w.owner_user_id = u.id
  );
--> statement-breakpoint
INSERT INTO "workspace_members" ("workspace_id", "user_id", "role")
SELECT w.id, w.owner_user_id, 'owner'
FROM "workspaces" w
WHERE NOT EXISTS (
  SELECT 1 FROM "workspace_members" m
  WHERE m.workspace_id = w.id AND m.user_id = w.owner_user_id
);
--> statement-breakpoint
UPDATE "source_configs" sc
SET "workspace_id" = w.id
FROM "workspaces" w
WHERE w.owner_user_id = sc.user_id
  AND sc.workspace_id IS NULL;
