// ** import database
import { desc, eq } from "drizzle-orm";

// ** import client
import { createClient } from "./client";

// ** import schema
import { executionEvent } from "./schema";

// ** import utils
import { newId } from "./schema/core";

const eventDb = createClient();

function isUniqueConflict(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return (
    message.includes("execution_event_execution_id_seq_unique_idx") ||
    message.includes("duplicate key") ||
    message.includes("unique constraint")
  );
}

export async function appendExecutionEventRecord(input: {
  executionId: string;
  type: string;
  payloadJson: unknown;
  maxAttempts?: number;
}) {
  const maxAttempts = input.maxAttempts ?? 5;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const [last] = await eventDb
        .select({ seq: executionEvent.seq })
        .from(executionEvent)
        .where(eq(executionEvent.executionId, input.executionId))
        .orderBy(desc(executionEvent.seq))
        .limit(1);

      const nextSeq = (last?.seq ?? 0) + 1;

      await eventDb.insert(executionEvent).values({
        id: newId(),
        executionId: input.executionId,
        seq: nextSeq,
        type: input.type,
        payloadJson: input.payloadJson,
      });

      return nextSeq;
    } catch (error) {
      if (attempt >= maxAttempts || !isUniqueConflict(error)) {
        throw error;
      }
    }
  }

  throw new Error("Failed to append execution event after retries");
}
