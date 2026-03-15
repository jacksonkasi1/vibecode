// ** import core packages
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

// ** import schema
import { user } from "./auth";

export const projectStatusEnum = ["active", "archived", "deleted"] as const;
export type ProjectStatus = (typeof projectStatusEnum)[number];

export const project = pgTable("project", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  description: text("description"),
  repositoryUrl: text("repository_url"),
  defaultBranch: text("default_branch").default("main"),
  userId: text("user_id")
    .notNull()
    .references(() => user.id, { onDelete: "cascade" }),
  status: text("status").$type<ProjectStatus>().notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Project = typeof project.$inferSelect;
export type NewProject = typeof project.$inferInsert;
