// ** import core packages
import {
  pgTable,
  text,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

// ** import schema
import { execution } from "./executions";

export const artifactTypeEnum = [
  "file",
  "diff",
  "log",
  "screenshot",
  "other",
] as const;
export type ArtifactType = (typeof artifactTypeEnum)[number];

export const artifact = pgTable("artifact", {
  id: text("id").primaryKey(),
  executionId: text("execution_id")
    .notNull()
    .references(() => execution.id, { onDelete: "cascade" }),
  type: text("type").$type<ArtifactType>().notNull().default("file"),
  name: text("name").notNull(),
  filePath: text("file_path"),
  storagePath: text("storage_path"),
  mimeType: text("mime_type"),
  sizeBytes: integer("size_bytes"),
  metadata: text("metadata"), // JSON stringified
  isActive: boolean("is_active").notNull().default(true),
  supersededByExecutionId: text("superseded_by_execution_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Artifact = typeof artifact.$inferSelect;
export type NewArtifact = typeof artifact.$inferInsert;
