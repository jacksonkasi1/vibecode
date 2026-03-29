CREATE TABLE "decision_log" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text,
	"workspace_id" text,
	"user_id" text NOT NULL,
	"execution_id" text,
	"decision" text NOT NULL,
	"rationale" text,
	"outcome" text,
	"category" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "intelligence_query_log" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"project_id" text,
	"workspace_id" text,
	"intent" text NOT NULL,
	"query" text NOT NULL,
	"services_used" jsonb,
	"execution_strategy" text DEFAULT 'direct' NOT NULL,
	"latency_ms" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_env" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_knowledge" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"framework" text,
	"language" text,
	"package_manager" text,
	"monorepo" text DEFAULT 'false' NOT NULL,
	"monorepo_tool" text,
	"architecture_summary" text,
	"file_structure_summary" text,
	"conventions_summary" text,
	"repository_owner" text,
	"repository_name" text,
	"repository_branch" text,
	"last_scanned_at" timestamp,
	"last_scanned_commit" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_secret_ref" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"key_name" text NOT NULL,
	"secret_path" text NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "task_continuation" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"workspace_id" text,
	"user_id" text NOT NULL,
	"execution_id" text,
	"title" text NOT NULL,
	"status" text DEFAULT 'paused' NOT NULL,
	"state_json" jsonb NOT NULL,
	"pending_tasks" jsonb,
	"completed_tasks" jsonb,
	"context_summary" text,
	"last_commit" text,
	"last_branch" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_preference" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"category" text NOT NULL,
	"key" text NOT NULL,
	"value" text NOT NULL,
	"learned_from" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "decision_log" ADD CONSTRAINT "decision_log_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_log" ADD CONSTRAINT "decision_log_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_log" ADD CONSTRAINT "decision_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "decision_log" ADD CONSTRAINT "decision_log_execution_id_execution_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."execution"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_query_log" ADD CONSTRAINT "intelligence_query_log_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_query_log" ADD CONSTRAINT "intelligence_query_log_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "intelligence_query_log" ADD CONSTRAINT "intelligence_query_log_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_env" ADD CONSTRAINT "project_env_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_knowledge" ADD CONSTRAINT "project_knowledge_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_secret_ref" ADD CONSTRAINT "project_secret_ref_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_continuation" ADD CONSTRAINT "task_continuation_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_continuation" ADD CONSTRAINT "task_continuation_workspace_id_workspace_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspace"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_continuation" ADD CONSTRAINT "task_continuation_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_continuation" ADD CONSTRAINT "task_continuation_execution_id_execution_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."execution"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_preference" ADD CONSTRAINT "user_preference_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "decision_log_project_idx" ON "decision_log" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "decision_log_user_idx" ON "decision_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "decision_log_execution_idx" ON "decision_log" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "intelligence_query_log_user_intent_idx" ON "intelligence_query_log" USING btree ("user_id","intent");--> statement-breakpoint
CREATE INDEX "intelligence_query_log_project_idx" ON "intelligence_query_log" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_env_project_id_idx" ON "project_env" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_env_project_key_unique_idx" ON "project_env" USING btree ("project_id","key");--> statement-breakpoint
CREATE INDEX "project_knowledge_project_id_idx" ON "project_knowledge" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_knowledge_project_id_unique_idx" ON "project_knowledge" USING btree ("project_id");--> statement-breakpoint
CREATE INDEX "project_secret_ref_project_id_idx" ON "project_secret_ref" USING btree ("project_id");--> statement-breakpoint
CREATE UNIQUE INDEX "project_secret_ref_project_key_unique_idx" ON "project_secret_ref" USING btree ("project_id","key_name");--> statement-breakpoint
CREATE INDEX "task_continuation_project_user_idx" ON "task_continuation" USING btree ("project_id","user_id");--> statement-breakpoint
CREATE INDEX "task_continuation_workspace_idx" ON "task_continuation" USING btree ("workspace_id");--> statement-breakpoint
CREATE INDEX "user_preference_user_category_idx" ON "user_preference" USING btree ("user_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "user_preference_user_key_unique_idx" ON "user_preference" USING btree ("user_id","category","key");