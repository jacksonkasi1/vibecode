CREATE TABLE "agent_task" (
	"id" text PRIMARY KEY NOT NULL,
	"execution_id" text NOT NULL,
	"parent_task_id" text,
	"agent_name" text NOT NULL,
	"description" text NOT NULL,
	"prompt" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"result" text,
	"error_message" text,
	"steps" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "parent_execution_id" text;--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "agent_name" text DEFAULT 'coder';--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "task_description" text;--> statement-breakpoint
ALTER TABLE "execution" ADD COLUMN "classification" text;--> statement-breakpoint
ALTER TABLE "agent_task" ADD CONSTRAINT "agent_task_execution_id_execution_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."execution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "agent_task" ADD CONSTRAINT "agent_task_parent_task_id_agent_task_id_fk" FOREIGN KEY ("parent_task_id") REFERENCES "public"."agent_task"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "agent_task_execution_id_idx" ON "agent_task" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "agent_task_parent_task_id_idx" ON "agent_task" USING btree ("parent_task_id");--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_parent_execution_id_execution_id_fk" FOREIGN KEY ("parent_execution_id") REFERENCES "public"."execution"("id") ON DELETE set null ON UPDATE no action;