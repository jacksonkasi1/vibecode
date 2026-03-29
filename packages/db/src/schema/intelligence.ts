// ** import core packages
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

// ** import schema
import { execution } from "./executions";
import { project } from "./projects";
import { user } from "./auth";
import { workspace } from "./workspaces";

export const projectKnowledge = pgTable(
  "project_knowledge",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    framework: text("framework"),
    language: text("language"),
    packageManager: text("package_manager"),
    monorepo: text("monorepo").notNull().default("false"),
    monorepoTool: text("monorepo_tool"),
    architectureSummary: text("architecture_summary"),
    fileStructureSummary: text("file_structure_summary"),
    conventionsSummary: text("conventions_summary"),
    repositoryOwner: text("repository_owner"),
    repositoryName: text("repository_name"),
    repositoryBranch: text("repository_branch"),
    lastScannedAt: timestamp("last_scanned_at"),
    lastScannedCommit: text("last_scanned_commit"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    projectIdx: index("project_knowledge_project_id_idx").on(table.projectId),
    uniqueProjectIdx: uniqueIndex("project_knowledge_project_id_unique_idx").on(
      table.projectId,
    ),
  }),
);

export const projectSecretRef = pgTable(
  "project_secret_ref",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    keyName: text("key_name").notNull(),
    secretPath: text("secret_path").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    projectIdx: index("project_secret_ref_project_id_idx").on(table.projectId),
    uniqueProjectKeyIdx: uniqueIndex(
      "project_secret_ref_project_key_unique_idx",
    ).on(table.projectId, table.keyName),
  }),
);

export const projectEnv = pgTable(
  "project_env",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    key: text("key").notNull(),
    value: text("value").notNull(),
    description: text("description"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    projectIdx: index("project_env_project_id_idx").on(table.projectId),
    uniqueProjectKeyIdx: uniqueIndex("project_env_project_key_unique_idx").on(
      table.projectId,
      table.key,
    ),
  }),
);

export const continuationStatusEnum = [
  "paused",
  "completed",
  "abandoned",
] as const;
export type ContinuationStatus = (typeof continuationStatusEnum)[number];

export const taskContinuation = pgTable(
  "task_continuation",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id")
      .notNull()
      .references(() => project.id, { onDelete: "cascade" }),
    workspaceId: text("workspace_id").references(() => workspace.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    executionId: text("execution_id").references(() => execution.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    status: text("status")
      .$type<ContinuationStatus>()
      .notNull()
      .default("paused"),
    stateJson: jsonb("state_json").notNull(),
    pendingTasks: jsonb("pending_tasks"),
    completedTasks: jsonb("completed_tasks"),
    contextSummary: text("context_summary"),
    lastCommit: text("last_commit"),
    lastBranch: text("last_branch"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    projectUserIdx: index("task_continuation_project_user_idx").on(
      table.projectId,
      table.userId,
    ),
    workspaceIdx: index("task_continuation_workspace_idx").on(
      table.workspaceId,
    ),
  }),
);

export const userPreference = pgTable(
  "user_preference",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    category: text("category").notNull(),
    key: text("key").notNull(),
    value: text("value").notNull(),
    learnedFrom: text("learned_from"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    userCategoryIdx: index("user_preference_user_category_idx").on(
      table.userId,
      table.category,
    ),
    uniqueUserPreferenceIdx: uniqueIndex(
      "user_preference_user_key_unique_idx",
    ).on(table.userId, table.category, table.key),
  }),
);

export const decisionLog = pgTable(
  "decision_log",
  {
    id: text("id").primaryKey(),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "cascade",
    }),
    workspaceId: text("workspace_id").references(() => workspace.id, {
      onDelete: "set null",
    }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    executionId: text("execution_id").references(() => execution.id, {
      onDelete: "set null",
    }),
    decision: text("decision").notNull(),
    rationale: text("rationale"),
    outcome: text("outcome"),
    category: text("category"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    projectIdx: index("decision_log_project_idx").on(table.projectId),
    userIdx: index("decision_log_user_idx").on(table.userId),
    executionIdx: index("decision_log_execution_idx").on(table.executionId),
  }),
);

export const executionStrategyEnum = ["direct", "cloud_run", "vm"] as const;
export type ExecutionStrategy = (typeof executionStrategyEnum)[number];

export const intelligenceQueryLog = pgTable(
  "intelligence_query_log",
  {
    id: text("id").primaryKey(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    projectId: text("project_id").references(() => project.id, {
      onDelete: "set null",
    }),
    workspaceId: text("workspace_id").references(() => workspace.id, {
      onDelete: "set null",
    }),
    intent: text("intent").notNull(),
    query: text("query").notNull(),
    servicesUsed: jsonb("services_used"),
    executionStrategy: text("execution_strategy")
      .$type<ExecutionStrategy>()
      .notNull()
      .default("direct"),
    latencyMs: integer("latency_ms"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    userIntentIdx: index("intelligence_query_log_user_intent_idx").on(
      table.userId,
      table.intent,
    ),
    projectIdx: index("intelligence_query_log_project_idx").on(table.projectId),
  }),
);

export type ProjectKnowledge = typeof projectKnowledge.$inferSelect;
export type NewProjectKnowledge = typeof projectKnowledge.$inferInsert;
export type ProjectSecretRef = typeof projectSecretRef.$inferSelect;
export type NewProjectSecretRef = typeof projectSecretRef.$inferInsert;
export type ProjectEnv = typeof projectEnv.$inferSelect;
export type NewProjectEnv = typeof projectEnv.$inferInsert;
export type TaskContinuation = typeof taskContinuation.$inferSelect;
export type NewTaskContinuation = typeof taskContinuation.$inferInsert;
export type UserPreference = typeof userPreference.$inferSelect;
export type NewUserPreference = typeof userPreference.$inferInsert;
export type DecisionLog = typeof decisionLog.$inferSelect;
export type NewDecisionLog = typeof decisionLog.$inferInsert;
export type IntelligenceQueryLog = typeof intelligenceQueryLog.$inferSelect;
export type NewIntelligenceQueryLog = typeof intelligenceQueryLog.$inferInsert;
