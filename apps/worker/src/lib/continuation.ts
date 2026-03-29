// ** import database
import {
  and,
  db,
  eq,
  newId,
  project,
  taskContinuation,
  workspace,
} from "@repo/db";

export async function saveExecutionContinuation(input: {
  executionId: string;
  workspaceId: string;
  userId: string;
  title: string;
  contextSummary: string;
  state: Record<string, unknown>;
  lastCommit?: string | null;
  lastBranch?: string | null;
}) {
  const rows = await db
    .select({ projectId: workspace.projectId })
    .from(workspace)
    .innerJoin(project, eq(workspace.projectId, project.id))
    .where(
      and(
        eq(workspace.id, input.workspaceId),
        eq(project.userId, input.userId),
      ),
    )
    .limit(1);

  const projectId = rows[0]?.projectId;
  if (!projectId) {
    return null;
  }

  const [saved] = await db
    .insert(taskContinuation)
    .values({
      id: newId(),
      projectId,
      workspaceId: input.workspaceId,
      userId: input.userId,
      executionId: input.executionId,
      title: input.title,
      status: "paused",
      stateJson: input.state,
      pendingTasks: input.state.pendingTasks ?? null,
      completedTasks: input.state.completedTasks ?? null,
      contextSummary: input.contextSummary,
      lastCommit: input.lastCommit ?? null,
      lastBranch: input.lastBranch ?? null,
    })
    .returning();

  return saved;
}
