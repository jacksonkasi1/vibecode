// ** import core packages
import {
  pgTable,
  text,
  timestamp,
  boolean,
  AnyPgColumn,
  integer,
  index,
} from "drizzle-orm/pg-core";

// ** import schema
import { user } from "./auth";
import { workspace } from "./workspaces";
import { chatThread } from "./chat";

export const executionStatusEnum = [
  "queued",
  "running",
  "completed",
  "conflicted",
  "failed",
  "cancelled",
] as const;
export type ExecutionStatus = (typeof executionStatusEnum)[number];

export type TaskClassification = "single" | "multi";
export type AgentTaskStatus = "pending" | "running" | "completed" | "failed";

export const execution = pgTable("execution", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  threadId: text("thread_id").references(() => chatThread.id, {
    onDelete: "cascade",
  }),
  prompt: text("prompt").notNull(),
  status: text("status").$type<ExecutionStatus>().notNull().default("queued"),
  modelId: text("model_id"),
  result: text("result"), // JSON stringified
  errorMessage: text("error_message"),
  mergedCommitHash: text("merged_commit_hash"),
  worktreeBranch: text("worktree_branch"),
  isReverted: boolean("is_reverted").notNull().default(false),
  revertedByExecutionId: text("reverted_by_execution_id").references(
    (): AnyPgColumn => execution.id,
    { onDelete: "set null" },
  ),
  revertedAt: timestamp("reverted_at"),
  startedAt: timestamp("started_at"),
  completedAt: timestamp("completed_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  // multi-agent fields
  parentExecutionId: text("parent_execution_id").references(
    (): AnyPgColumn => execution.id,
    { onDelete: "set null" },
  ),
  agentName: text("agent_name").default("coder"),
  taskDescription: text("task_description"),
  classification: text("classification").$type<TaskClassification>(),
  runtime: text("runtime").notNull().default("deepagents"),
  runtimeExecutionId: text("runtime_execution_id"),
  selectedSkillsJson: text("selected_skills_json"),
});

export const agentTask = pgTable(
  "agent_task",
  {
    id: text("id").primaryKey(),
    executionId: text("execution_id")
      .notNull()
      .references(() => execution.id, { onDelete: "cascade" }),
    parentTaskId: text("parent_task_id").references(
      (): AnyPgColumn => agentTask.id,
      { onDelete: "set null" },
    ),
    agentName: text("agent_name").notNull(),
    description: text("description").notNull(),
    prompt: text("prompt").notNull(),
    status: text("status")
      .$type<AgentTaskStatus>()
      .notNull()
      .default("pending"),
    result: text("result"),
    errorMessage: text("error_message"),
    runtimeTaskKey: text("runtime_task_key"),
    metadataJson: text("metadata_json"),
    steps: integer("steps").default(0),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
    completedAt: timestamp("completed_at"),
  },
  (table) => ({
    executionIdIdx: index("agent_task_execution_id_idx").on(table.executionId),
    parentTaskIdx: index("agent_task_parent_task_id_idx").on(
      table.parentTaskId,
    ),
  }),
);

export type Execution = typeof execution.$inferSelect;
export type NewExecution = typeof execution.$inferInsert;
export type AgentTask = typeof agentTask.$inferSelect;
export type NewAgentTask = typeof agentTask.$inferInsert;
