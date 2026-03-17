// ** import core packages
import {
  pgTable,
  text,
  timestamp,
  boolean,
  AnyPgColumn,
} from "drizzle-orm/pg-core";

// ** import schema
import { user } from "./auth";
import { workspace } from "./workspaces";
import { chatThread } from "./chat";

export const executionStatusEnum = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type ExecutionStatus = (typeof executionStatusEnum)[number];

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
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Execution = typeof execution.$inferSelect;
export type NewExecution = typeof execution.$inferInsert;
