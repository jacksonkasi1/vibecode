// ** import lib
import { logger } from "@repo/logs";

// ** import config
import { env } from "@/config/env";
import { recoverStaleExecutions, startPoller } from "./poller";
import { startPubSubListener } from "./pubsub";

async function main() {
  logger.info("🚀 VIBECode Worker starting...");
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`Dispatch Mode: ${env.WORKER_DISPATCH_MODE}`);
  logger.info(`Polling Interval: ${env.POLL_INTERVAL_MS}ms`);
  logger.info(`Workspace Dir: ${env.WORKSPACE_DIR}`);

  // Recover any executions left in "running" state from a previous worker
  // process (crash / restart) before starting the dispatch loop.
  await recoverStaleExecutions();

  if (env.WORKER_DISPATCH_MODE === "pubsub") {
    try {
      await startPubSubListener();

      if (env.PUBSUB_ENABLE_POLLER_FALLBACK) {
        logger.info("Starting poller fallback alongside Pub/Sub listener.");
        void startPoller();
      }
    } catch (error) {
      logger.error(
        `Failed to start Pub/Sub listener, falling back to poller: ${error instanceof Error ? error.message : String(error)}`,
      );
      void startPoller();
    }
  } else {
    // Start background poller loop for local/dev mode
    void startPoller();
  }

  // Keep process alive
  process.on("SIGINT", () => {
    logger.info("Worker shutting down...");
    process.exit(0);
  });
}

main().catch((error) => {
  logger.error(
    `Fatal error in worker: ${error instanceof Error ? error.message : String(error)}`,
  );
  process.exit(1);
});
