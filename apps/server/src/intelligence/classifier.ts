// ** import lib
import { db, eq, project } from "@repo/db";

export type IntelligenceIntent =
  | "status_query"
  | "knowledge_query"
  | "cross_project_search";

export interface ClassificationResult {
  intent: IntelligenceIntent;
  projectId?: string;
  confidence: number;
  requiresExecution: false;
  requiresContext: Array<"postgres" | "vector" | "github_api">;
}

export async function classifyIntelligenceQuery(input: {
  message: string;
  userId: string;
  projectId?: string;
}) {
  const normalizedMessage = input.message.toLowerCase();
  const userProjects = await db
    .select({
      id: project.id,
      name: project.name,
      repositoryUrl: project.repositoryUrl,
    })
    .from(project)
    .where(eq(project.userId, input.userId));

  const resolvedProject = input.projectId
    ? userProjects.find((candidate) => candidate.id === input.projectId)
    : userProjects.find((candidate) =>
        normalizedMessage.includes(candidate.name.toLowerCase()),
      );

  if (
    normalizedMessage.includes("which project") ||
    normalizedMessage.includes("which of my projects") ||
    normalizedMessage.includes("across projects")
  ) {
    return {
      intent: "cross_project_search",
      confidence: 0.85,
      requiresExecution: false,
      requiresContext: ["vector", "postgres"],
    } satisfies ClassificationResult;
  }

  if (
    normalizedMessage.includes("status") ||
    normalizedMessage.includes("what's going on") ||
    normalizedMessage.includes("what is happening")
  ) {
    return {
      intent: "status_query",
      projectId: resolvedProject?.id,
      confidence: 0.9,
      requiresExecution: false,
      requiresContext: ["postgres"],
    } satisfies ClassificationResult;
  }

  return {
    intent: "knowledge_query",
    projectId: resolvedProject?.id,
    confidence: 0.8,
    requiresExecution: false,
    requiresContext: ["postgres", "vector"],
  } satisfies ClassificationResult;
}
