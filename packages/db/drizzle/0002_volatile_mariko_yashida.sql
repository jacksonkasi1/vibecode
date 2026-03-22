CREATE TABLE "workspace_operation" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"execution_id" text,
	"user_id" text,
	"operation" text NOT NULL,
	"details" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_revision" (
	"id" text PRIMARY KEY NOT NULL,
	"workspace_id" text NOT NULL,
	"execution_id" text,
	"commit_hash" text NOT NULL,
	"parent_hash" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "artifact" ADD COLUMN "is_active" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "artifact" ADD COLUMN "superseded_by_execution_id" text;--> statement-breakpoint
ALTER TABLE "chat_thread" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "chat_thread" ADD COLUMN "archived_at" timestamp;--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "merged_commit_hash" text;--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "worktree_branch" text;--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "is_reverted" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "reverted_by_execution_id" text;--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "reverted_at" timestamp;--> statement-breakpoint
ALTER TABLE "workspace_operation" ADD CONSTRAINT "workspace_operation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_operation" ADD CONSTRAINT "workspace_operation_execution_id_execution_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."execution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_operation" ADD CONSTRAINT "workspace_operation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_revision" ADD CONSTRAINT "workspace_revision_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_revision" ADD CONSTRAINT "workspace_revision_execution_id_execution_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."execution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_revision" ADD CONSTRAINT "workspace_revision_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_reverted_by_execution_id_execution_id_fk" FOREIGN KEY ("reverted_by_execution_id") REFERENCES "public"."execution"("id") ON DELETE set null ON UPDATE no action;