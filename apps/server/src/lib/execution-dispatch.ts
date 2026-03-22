// ** import core packages
import { PubSub } from "@google-cloud/pubsub";

// ** import utils
import { logger } from "@repo/logs";

// ** import config
import { env } from "@/config/env";

let pubsubClient: PubSub | null = null;

function getPubSubClient() {
  if (!pubsubClient) {
    pubsubClient = new PubSub({
      projectId: env.PUBSUB_PROJECT_ID,
    });
  }

  return pubsubClient;
}

export async function dispatchExecutionQueued(payload: {
  executionId: string;
  workspaceId: string;
  userId: string;
}) {
  if (env.EXECUTION_DISPATCH_MODE !== "pubsub") return;

  if (!env.PUBSUB_PROJECT_ID || !env.PUBSUB_EXECUTIONS_TOPIC) {
    logger.warn(
      "EXECUTION_DISPATCH_MODE=pubsub but PUBSUB_PROJECT_ID/PUBSUB_EXECUTIONS_TOPIC are not configured. Falling back to polling worker pickup.",
    );
    return;
  }

  try {
    const topic = getPubSubClient().topic(env.PUBSUB_EXECUTIONS_TOPIC);
    await topic.publishMessage({
      data: Buffer.from(
        JSON.stringify({
          executionId: payload.executionId,
          workspaceId: payload.workspaceId,
          userId: payload.userId,
          queuedAt: new Date().toISOString(),
        }),
      ),
      attributes: {
        executionId: payload.executionId,
        workspaceId: payload.workspaceId,
      },
    });
  } catch (error) {
    logger.error(
      `Failed to publish execution ${payload.executionId} to Pub/Sub: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}
