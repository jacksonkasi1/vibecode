// ** import core packages
import { Hono } from "hono";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

// ** import lib
import { db } from "@repo/db";
import {
  execution,
  workspace,
  workspaceOperation,
  workspaceRevision,
  eq,
  and,
  gte,
} from "@repo/db";
import { newId } from "@repo/db";
import { logger } from "@repo/logs";

// ** import config
import { env } from "@/config/env";
import { withWorkspaceLock } from "@/lib/workspace-lock";

// ** import types
import type { AppEnv } from "@/types";

const execAsync = promisify(exec);
const route = new Hono<AppEnv>();

route.post("/:id/undo", async (c) => {
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
    if (execRecord.isReverted) {
      return c.json({ error: "Execution already reverted" }, 400);
    }

    const workspacePath = path.join(
      env.WORKSPACE_DIR || "/tmp/vibecode-workspaces",
      execRecord.workspaceId,
    );

    // Look up the parent hash to do a hard reset to the state BEFORE this execution
    const [revision] = await db
      .select()
      .from(workspaceRevision)
      .where(eq(workspaceRevision.executionId, execRecord.id))
      .limit(1);

    const targetResetHash = revision?.parentHash;

    if (targetResetHash) {
      await withWorkspaceLock(
        env.WORKSPACE_DIR || "/tmp/vibecode-workspaces",
        execRecord.workspaceId,
        async () => {
          // --- Phase 3: Two-Phase Rollback using low-level Git plumbing ---
          // Step 1: Restore the working tree to the target commit state.
          //   - git read-tree populates the index from the target tree.
          //   - git checkout-index writes every indexed file to the working directory.
          //   - git clean removes any untracked files left behind.
          //   - A second git read-tree re-syncs the index cleanly.
          // Step 2: Only update the DB if Step 1 fully succeeds (strict two-phase).

          try {
            // Phase A — Restore working tree (plumbing, not porcelain)
            await execAsync(`git read-tree ${targetResetHash}`, {
              cwd: workspacePath,
            });
            await execAsync(`git checkout-index -a -f`, { cwd: workspacePath });
            await execAsync(`git clean -fd`, { cwd: workspacePath });
            // Re-sync index to match HEAD state after the checkout
            await execAsync(`git read-tree HEAD`, { cwd: workspacePath });

            logger.info(
              `Workspace ${execRecord.workspaceId} two-phase rolled back to ${targetResetHash} (before execution ${id})`,
            );
          } catch (error) {
            throw new Error(
              `Two-phase reset failed: ${error instanceof Error ? error.message : String(error)}`,
            );
          }
        },
      );
    } else {
      logger.warn(
        `Could not find parent hash for execution ${id}, marking reverted anyway without git reset.`,
      );
    }

    // Mark this execution AND ALL SUBSEQUENT executions in the same thread as reverted
    let revertedCount = 0;
    await db.transaction(async (tx) => {
      const subsequentExecs = await tx
        .select({ id: execution.id, status: execution.status })
        .from(execution)
        .where(
          and(
            eq(execution.threadId, execRecord.threadId || ""),
            gte(execution.createdAt, execRecord.createdAt),
          ),
        );

      const execIds = subsequentExecs.map((e) => e.id);

      if (execIds.length > 0) {
        // Need to do this in batches or individual updates if not supported, but in postgres IN clause works well.
        // Drizzle doesn't easily do update with IN array out of the box without inArray, so we'll just loop.
        for (const targetId of execIds) {
          const targetExec = subsequentExecs.find((e) => e.id === targetId);
          // If execution is queued or running, cancel it so worker halts
          await tx
            .update(execution)
            .set({
              isReverted: true,
              revertedAt: new Date(),
              revertedByExecutionId: id,
              status: ["queued", "running"].includes(targetExec?.status || "")
                ? "cancelled"
                : undefined,
            })
            .where(eq(execution.id, targetId));
          revertedCount++;
        }
      }

      await tx.insert(workspaceOperation).values({
        id: newId(),
        workspaceId: execRecord.workspaceId,
        executionId: id,
        userId: user.id,
        operation: "reset",
        details: JSON.stringify({
          resetToHash: targetResetHash,
          reason: "User requested undo to before this prompt",
          revertedExecutionCount: revertedCount,
        }),
      });
    });

    return c.json({ data: { success: true, prompt: execRecord.prompt } });
  } catch (error) {
    logger.error(
      `Failed to undo execution: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to undo execution" }, 500);
  }
});

export default route;
