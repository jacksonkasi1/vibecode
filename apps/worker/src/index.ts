// ** import lib
import { logger } from "@repo/logs";

// ** import config
import { env } from "@/config/env";
import { startPoller } from "./poller";

async function main() {
  logger.info("🚀 VIBECode Worker starting...");
  logger.info(`Environment: ${env.NODE_ENV}`);
  logger.info(`Polling Interval: ${env.POLL_INTERVAL_MS}ms`);
  logger.info(`Workspace Dir: ${env.WORKSPACE_DIR}`);

  // Start background poller loop
  startPoller();

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
