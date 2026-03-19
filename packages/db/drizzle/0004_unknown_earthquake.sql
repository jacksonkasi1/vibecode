ALTER TABLE "agent_task" ADD COLUMN "runtime_task_key" text;--> statement-breakpoint
ALTER TABLE "agent_task" ADD COLUMN "metadata_json" text;--> statement-breakpoint
ALTER TABLE "agent_task" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "runtime" text DEFAULT 'deepagents' NOT NULL;--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "runtime_execution_id" text;--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "selected_skills_json" text;