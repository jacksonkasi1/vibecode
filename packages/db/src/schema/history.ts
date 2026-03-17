// ** import core packages
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ** import schema
import { user } from "./auth";
import { workspace } from "./workspaces";
import { execution } from "./executions";

export const workspaceRevision = pgTable("workspace_revision", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  executionId: text("execution_id").references(() => execution.id, {
    onDelete: "cascade",
  }),
  commitHash: text("commit_hash").notNull(),
  parentHash: text("parent_hash"),
  createdBy: text("created_by").references(() => user.id, {
    onDelete: "set null",
  }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const workspaceOperationEnum = [
  "rename",
  "reset",
  "revert",
  "merge",
  "conflict",
] as const;
export type WorkspaceOperationType = (typeof workspaceOperationEnum)[number];

export const workspaceOperation = pgTable("workspace_operation", {
  id: text("id").primaryKey(),
  workspaceId: text("workspace_id")
    .notNull()
    .references(() => workspace.id, { onDelete: "cascade" }),
  executionId: text("execution_id").references(() => execution.id, {
    onDelete: "cascade",
  }),
  userId: text("user_id").references(() => user.id, { onDelete: "set null" }),
  operation: text("operation").$type<WorkspaceOperationType>().notNull(),
  details: text("details"), // JSON stringified metadata about the operation
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type WorkspaceRevision = typeof workspaceRevision.$inferSelect;
export type NewWorkspaceRevision = typeof workspaceRevision.$inferInsert;

export type WorkspaceOperation = typeof workspaceOperation.$inferSelect;
export type NewWorkspaceOperation = typeof workspaceOperation.$inferInsert;
