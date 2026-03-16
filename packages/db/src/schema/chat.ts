// ** import core packages
import {
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

// ** import schema
import { user } from "./auth";
import { workspace } from "./workspaces";

export const chatRoleEnum = ["system", "user", "assistant", "tool"] as const;
export type ChatRole = (typeof chatRoleEnum)[number];

export const chatThread = pgTable(
  "chat_thread",
  {
    id: text("id").primaryKey(),
    workspaceId: text("workspace_id")
      .notNull()
      .references(() => workspace.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    title: text("title"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => ({
    workspaceUpdatedAtIdx: index("chat_thread_workspace_id_updated_at_idx").on(
      table.workspaceId,
      table.updatedAt,
    ),
  }),
);

export const chatMessage = pgTable(
  "chat_message",
  {
    id: text("id").primaryKey(),
    threadId: text("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    role: text("role").$type<ChatRole>().notNull(),
    contentJson: jsonb("content_json").notNull(),
    tokenCount: integer("token_count"),
    parentId: text("parent_id"),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    threadCreatedAtIdx: index("chat_message_thread_id_created_at_idx").on(
      table.threadId,
      table.createdAt,
    ),
  }),
);

export type ChatThread = typeof chatThread.$inferSelect;
export type NewChatThread = typeof chatThread.$inferInsert;

export type ChatMessage = typeof chatMessage.$inferSelect;
export type NewChatMessage = typeof chatMessage.$inferInsert;
