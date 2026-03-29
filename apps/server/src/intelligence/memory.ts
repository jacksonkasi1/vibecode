// ** import lib
import { db, newId } from "@repo/db";

// ** import schema
import { intelligenceQueryLog } from "@repo/db";

import type { ClassificationResult } from "./classifier";

export async function logIntelligenceQuery(input: {
  userId: string;
  projectId?: string;
  workspaceId?: string;
  classification: ClassificationResult;
  query: string;
  latencyMs: number;
}) {
  await db.insert(intelligenceQueryLog).values({
    id: newId(),
    userId: input.userId,
    projectId: input.projectId ?? null,
    workspaceId: input.workspaceId ?? null,
    intent: input.classification.intent,
    query: input.query,
    servicesUsed: input.classification.requiresContext,
    executionStrategy: "direct",
    latencyMs: input.latencyMs,
  });
}
