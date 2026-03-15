// ** import core packages
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ** import schema
import { project } from "./projects";

export const workspaceStatusEnum = [
  "idle",
  "starting",
  "running",
  "stopping",
  "stopped",
  "error",
] as const;
export type WorkspaceStatus = (typeof workspaceStatusEnum)[number];

export const workspace = pgTable("workspace", {
  id: text("id").primaryKey(),
  projectId: text("project_id")
    .notNull()
    .references(() => project.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  status: text("status").$type<WorkspaceStatus>().notNull().default("idle"),
  branch: text("branch").default("main"),
  metadata: text("metadata"), // JSON stringified
  lastActiveAt: timestamp("last_active_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Workspace = typeof workspace.$inferSelect;
export type NewWorkspace = typeof workspace.$inferInsert;
