// ** import lib
import { db } from "@repo/db";
import { agentTask, execution, and, eq, inArray } from "@repo/db";
import { logger } from "@repo/logs";

// ** import config
import { env } from "@/config/env";
import { runExecution } from "./runner";

let isPolling = false;

function formatUnknownError(error: unknown) {
  if (error instanceof Error) {
    return error.stack || error.message;
  }

  if (typeof error === "object" && error !== null) {
    const maybeErrorEvent = error as {
      type?: unknown;
      message?: unknown;
      reason?: unknown;
      code?: unknown;
    };

    try {
      return JSON.stringify({
        type: maybeErrorEvent.type,
        message: maybeErrorEvent.message,
        reason: maybeErrorEvent.reason,
        code: maybeErrorEvent.code,
      });
    } catch {
      return String(error);
    }
  }

  return String(error);
}

/**
 * On worker startup, any execution that was left in "running" state from a
 * previous process (crash or restart) will never be retried because the poller
 * only picks up "queued" records.  This function marks those orphaned executions
 * (and their running agent_task rows) as "failed" so the UI no longer shows them
 * as perpetually running and the DB stops being queried for them.
 */
export async function recoverStaleExecutions() {
  try {
    const stale = await db
      .select({ id: execution.id })
      .from(execution)
      .where(eq(execution.status, "running"));

    if (stale.length === 0) {
      logger.info("No stale running executions found on startup.");
      return;
    }

    const staleIds = stale.map((r) => r.id);
    logger.warn(
      `Found ${staleIds.length} stale running execution(s) on startup. Marking as failed: ${staleIds.join(", ")}`,
    );

    const errorMessage =
      "Worker was restarted while this execution was running. The execution did not complete.";

    // Mark orphaned agent tasks as failed first (child rows)
    await db
      .update(agentTask)
      .set({
        status: "failed",
        errorMessage,
        updatedAt: new Date(),
        completedAt: new Date(),
      })
      .where(
        and(
          inArray(agentTask.executionId, staleIds),
          eq(agentTask.status, "running"),
        ),
      );

    // Mark orphaned executions as failed
    await db
      .update(execution)
      .set({
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      })
      .where(inArray(execution.id, staleIds));

    logger.info(`Marked ${staleIds.length} stale execution(s) as failed.`);
  } catch (error) {
    // Non-fatal — log and continue so the worker still starts
    logger.error(
      `Failed to recover stale executions on startup: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function startPoller() {
  if (isPolling) return;
  isPolling = true;

  logger.info("Initializing execution poller...");

  // Start the polling loop
  for (;;) {
    try {
      await pollForExecution();
    } catch (error) {
      logger.error(`Poller error: ${formatUnknownError(error)}`);
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, env.POLL_INTERVAL_MS));
  }
}

async function pollForExecution() {
  const [queued] = await db
    .select({ id: execution.id })
    .from(execution)
    .where(eq(execution.status, "queued"))
    .orderBy(execution.createdAt)
    .limit(1);

  if (!queued) return false;

  const claimed = await claimExecutionById(queued.id);

  if (!claimed) {
    logger.warn(`Execution ${queued.id} was claimed by another worker.`);
    return false;
  }

  runClaimedExecution(claimed);
  return true;
}

export async function claimAndRunExecutionById(executionId: string) {
  const claimed = await claimExecutionById(executionId);
  if (!claimed) {
    logger.warn(
      `Execution ${executionId} is not claimable (already running or finished).`,
    );
    return false;
  }

  runClaimedExecution(claimed);
  return true;
}

async function claimExecutionById(executionId: string) {
  const [claimed] = await db
    .update(execution)
    .set({
      status: "running",
      startedAt: new Date(),
    })
    .where(and(eq(execution.id, executionId), eq(execution.status, "queued")))
    .returning();

  return claimed;
}

function runClaimedExecution(claimed: typeof execution.$inferSelect) {
  logger.info(`Claimed execution ${claimed.id}. Starting runner...`);

  // Run the execution asynchronously so the poller isn't completely blocked
  // (In a real system with multiple concurrent workers, we'd use a worker pool)
  runExecution(claimed).catch((error: unknown) => {
    logger.error(
      `Runner failed for execution ${claimed.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
}
