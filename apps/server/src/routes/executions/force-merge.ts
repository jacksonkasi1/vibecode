// ** import core packages
import { Hono } from "hono";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

// ** import lib
import { db } from "@repo/db";
import { execution, workspace, workspaceRevision, eq, and } from "@repo/db";
import { newId } from "@repo/db";
import { logger } from "@repo/logs";

// ** import config
import { env } from "@/config/env";
import { withWorkspaceLock } from "@/lib/workspace-lock";

// ** import types
import type { AppEnv } from "@/types";

const execFileAsync = promisify(execFile);
const route = new Hono<AppEnv>();

/**
 * Run a git command safely using execFile (no shell injection).
 * Each argument is passed as a separate array element.
 */
function git(
  cwd: string,
  ...args: string[]
): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync("git", args, { cwd });
}

/**
 * POST /executions/:id/force-merge
 *
 * For a "conflicted" execution: re-applies the execution's branch on top of
 * main using the "ours" strategy (this execution's changes win). Updates the
 * execution status to "completed" with a mergedCommitHash on success.
 * Also inserts a workspaceRevision row so that subsequent undo operations work.
 */
route.post("/:id/force-merge", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const [found] = await db
      .select({ execution, workspace })
      .from(execution)
      .innerJoin(workspace, eq(execution.workspaceId, workspace.id))
      .where(and(eq(execution.id, id), eq(execution.userId, user.id)))
      .limit(1);

    if (!found) return c.json({ error: "Execution not found" }, 404);

    const execRecord = found.execution;

    if (execRecord.status !== "conflicted") {
      return c.json(
        { error: "Only conflicted executions can be force-merged" },
        400,
      );
    }

    if (!execRecord.worktreeBranch) {
      return c.json(
        { error: "No preserved branch found for this execution" },
        400,
      );
    }

    const workspacePath = path.join(env.WORKSPACE_DIR, execRecord.workspaceId);
    const worktreeBranch = execRecord.worktreeBranch;

    let mergedCommitHash = "";
    let parentHash: string | null = null;

    // All git operations AND the DB status update happen inside the lock to
    // prevent TOCTOU races with concurrent agents.
    await withWorkspaceLock(
      env.WORKSPACE_DIR,
      execRecord.workspaceId,
      async () => {
        // Capture the current HEAD before merging (this becomes parentHash for the revision)
        try {
          const { stdout: preOut } = await git(
            workspacePath,
            "log",
            "-1",
            "--format=%H",
          );
          parentHash = preOut.trim() || null;
        } catch {
          // non-fatal — parentHash stays null
        }

        // Strategy: merge the conflicted branch with -X ours so this
        // execution's file versions win on every conflicting hunk.
        await git(
          workspacePath,
          "merge",
          worktreeBranch,
          "--no-ff",
          "-X",
          "ours",
          "-m",
          `Force-merge execution ${id} (conflict resolved: ours wins)`,
        );

        const { stdout: hashOut } = await git(
          workspacePath,
          "log",
          "-1",
          "--format=%H",
        );
        mergedCommitHash = hashOut.trim();

        // Clean up the worktree now that the branch has been merged.
        // The worktree directory lives under .worktrees/<workspaceId>/<executionId>
        const worktreeDir = path.join(
          env.WORKSPACE_DIR,
          ".worktrees",
          execRecord.workspaceId,
          execRecord.id,
        );
        await git(
          workspacePath,
          "worktree",
          "remove",
          "--force",
          worktreeDir,
        ).catch(() => {});
        await git(workspacePath, "worktree", "prune").catch(() => {});

        // Persist results inside the lock so nothing else can race on status.
        await db.transaction(async (tx) => {
          await tx
            .update(execution)
            .set({
              status: "completed",
              errorMessage: null,
              mergedCommitHash,
              updatedAt: new Date(),
            })
            .where(eq(execution.id, id));

          // Insert a workspaceRevision row so that undo (git read-tree) can
          // roll back to the state before this force-merge.
          await tx.insert(workspaceRevision).values({
            id: newId(),
            workspaceId: execRecord.workspaceId,
            executionId: id,
            commitHash: mergedCommitHash,
            parentHash,
            createdBy: execRecord.userId,
          });
        });
      },
    );

    logger.info(
      `Force-merged execution ${id} into workspace ${execRecord.workspaceId} at ${mergedCommitHash}`,
    );

    return c.json({ data: { success: true, mergedCommitHash } });
  } catch (error) {
    logger.error(
      `Failed to force-merge execution: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to force-merge execution" }, 500);
  }
});

export default route;
