// ** import core packages
import type { Message, Subscription } from "@google-cloud/pubsub";
import { PubSub } from "@google-cloud/pubsub";

// ** import utils
import { logger } from "@repo/logs";

// ** import config
import { env } from "@/config/env";
import { claimAndRunExecutionById } from "./poller";

let pubSubSubscription: Subscription | null = null;

export async function startPubSubListener() {
  if (!env.PUBSUB_PROJECT_ID || !env.PUBSUB_EXECUTIONS_SUBSCRIPTION) {
    throw new Error(
      "PUBSUB_PROJECT_ID and PUBSUB_EXECUTIONS_SUBSCRIPTION are required for Pub/Sub mode",
    );
  }

  if (pubSubSubscription) return;

  const pubsub = new PubSub({ projectId: env.PUBSUB_PROJECT_ID });
  pubSubSubscription = pubsub.subscription(env.PUBSUB_EXECUTIONS_SUBSCRIPTION, {
    flowControl: {
      maxMessages: 4,
      allowExcessMessages: false,
    },
  });

  logger.info(
    `Listening to Pub/Sub subscription ${env.PUBSUB_EXECUTIONS_SUBSCRIPTION}`,
  );

  pubSubSubscription.on("message", (message) => {
    void handleMessage(message);
  });

  pubSubSubscription.on("error", (error) => {
    logger.error(
      `Pub/Sub listener error: ${error instanceof Error ? error.message : String(error)}`,
    );
  });
}

async function handleMessage(message: Message) {
  try {
    const raw = message.data.toString("utf-8");
    const payload = JSON.parse(raw) as { executionId?: unknown };
    const executionId =
      typeof payload.executionId === "string" ? payload.executionId : null;

    if (!executionId) {
      logger.warn("Pub/Sub message missing executionId. Acking message.");
      message.ack();
      return;
    }

    const didRun = await claimAndRunExecutionById(executionId);

    if (!didRun) {
      logger.warn(`Execution ${executionId} was not queued at consume time.`);
    }

    message.ack();
  } catch (error) {
    logger.error(
      `Failed to process Pub/Sub message: ${error instanceof Error ? error.message : String(error)}`,
    );
    message.nack();
  }
}
