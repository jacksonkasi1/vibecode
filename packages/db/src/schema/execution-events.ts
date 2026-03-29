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

export const executionEvent = pgTable(
  "execution_event",
  {
    id: text("id").primaryKey(),
    executionId: text("execution_id")
      .notNull()
      .references(() => execution.id, { onDelete: "cascade" }),
    seq: integer("seq").notNull(),
    type: text("type").notNull(),
    payloadJson: jsonb("payload_json").notNull(),
    createdAt: timestamp("created_at").notNull().defaultNow(),
  },
  (table) => ({
    executionSeqIdx: index("execution_event_execution_id_seq_idx").on(
      table.executionId,
      table.seq,
    ),
    executionSeqUniqueIdx: uniqueIndex(
      "execution_event_execution_id_seq_unique_idx",
    ).on(table.executionId, table.seq),
  }),
);

export type ExecutionEvent = typeof executionEvent.$inferSelect;
export type NewExecutionEvent = typeof executionEvent.$inferInsert;
