// ** import lib
import { db } from "@repo/db";
import { execution, eq } from "@repo/db";
import { logger } from "@repo/logs";

// ** import config
import { env } from "@/config/env";
import { runExecution } from "./runner";

let isPolling = false;

export async function startPoller() {
  if (isPolling) return;
  isPolling = true;

  logger.info("Initializing execution poller...");

  // Start the polling loop
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      await pollForExecution();
    } catch (error) {
      logger.error(
        `Poller error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }

    // Wait before next poll
    await new Promise((resolve) => setTimeout(resolve, env.POLL_INTERVAL_MS));
  }
}

async function pollForExecution() {
  // Find a queued execution
  const [queued] = await db
    .select()
    .from(execution)
    .where(eq(execution.status, "queued"))
    .orderBy(execution.createdAt)
    .limit(1);

  if (!queued) return;

  // Attempt to claim it
  const [claimed] = await db
    .update(execution)
    .set({
      status: "running",
      startedAt: new Date(),
    })
    .where(eq(execution.id, queued.id))
    .returning();

  if (!claimed) {
    logger.warn(`Execution ${queued.id} was claimed by another worker.`);
    return;
  }

  logger.info(`Claimed execution ${claimed.id}. Starting runner...`);

  // Run the execution asynchronously so the poller isn't completely blocked
  // (In a real system with multiple concurrent workers, we'd use a worker pool)
  runExecution(claimed).catch((error: unknown) => {
    logger.error(
      `Runner failed for execution ${claimed.id}: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
}
