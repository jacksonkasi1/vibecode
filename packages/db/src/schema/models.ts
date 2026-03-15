// ** import core packages
import {
  pgTable,
  text,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";

export const modelProvider = pgTable("model_provider", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  slug: text("slug").notNull().unique(),
  apiBaseUrl: text("api_base_url"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ModelProvider = typeof modelProvider.$inferSelect;
export type NewModelProvider = typeof modelProvider.$inferInsert;

export const modelConfig = pgTable("model_config", {
  id: text("id").primaryKey(),
  providerId: text("provider_id")
    .notNull()
    .references(() => modelProvider.id, { onDelete: "cascade" }),
  modelId: text("model_id").notNull(),
  displayName: text("display_name").notNull(),
  maxTokens: integer("max_tokens"),
  contextWindow: integer("context_window"),
  isDefault: boolean("is_default").notNull().default(false),
  capabilities: text("capabilities"), // JSON stringified
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ModelConfig = typeof modelConfig.$inferSelect;
export type NewModelConfig = typeof modelConfig.$inferInsert;
