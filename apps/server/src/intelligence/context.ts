// ** import lib
import { and, db, desc, eq, execution, project } from "@repo/db";

// ** import schema
import { projectKnowledge, taskContinuation } from "@repo/db";

// ** import apis
import { generateQueryEmbedding, queryVectors } from "@repo/ai";

// ** import intelligence
import type { ClassificationResult } from "./classifier";

export async function assembleIntelligenceContext(input: {
  classification: ClassificationResult;
  message: string;
  userId: string;
}) {
  const projectId = input.classification.projectId;

  const [projects, knowledge, recentExecutions, continuations] =
    await Promise.all([
      db
        .select()
        .from(project)
        .where(eq(project.userId, input.userId))
        .orderBy(desc(project.updatedAt)),
      projectId
        ? db
            .select()
            .from(projectKnowledge)
            .where(eq(projectKnowledge.projectId, projectId))
            .limit(1)
        : Promise.resolve([]),
      projectId
        ? db
            .select()
            .from(execution)
            .where(eq(execution.userId, input.userId))
            .orderBy(desc(execution.createdAt))
            .limit(5)
        : Promise.resolve([]),
      projectId
        ? db
            .select()
            .from(taskContinuation)
            .where(
              and(
                eq(taskContinuation.projectId, projectId),
                eq(taskContinuation.userId, input.userId),
              ),
            )
            .orderBy(desc(taskContinuation.updatedAt))
            .limit(5)
        : Promise.resolve([]),
    ]);

  let vectorMatches: Awaited<ReturnType<typeof queryVectors>> = [];
  if (input.classification.requiresContext.includes("vector")) {
    const queryVector = await generateQueryEmbedding(input.message).catch(
      () => [],
    );
    if (queryVector.length) {
      const filters = [`userId = '${input.userId}'`];
      if (projectId) {
        filters.push(`projectId = '${projectId}'`);
      }

      vectorMatches = await queryVectors({
        vector: queryVector,
        topK: 6,
        filter: filters.join(" AND "),
        includeMetadata: true,
        includeData: true,
      }).catch(() => []);
    }
  }

  return {
    projects,
    projectKnowledge: knowledge[0] ?? null,
    recentExecutions,
    continuations,
    vectorMatches,
  };
}
