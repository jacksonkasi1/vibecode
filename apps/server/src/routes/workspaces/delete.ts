// ** import core packages
import { Hono } from "hono";
import { exec } from "node:child_process";
import { rm } from "node:fs/promises";
import { promisify } from "node:util";
import path from "node:path";

// ** import lib
import { db } from "@repo/db";
import {
  workspace,
  project,
  execution,
  artifact,
  eq,
  and,
  inArray,
} from "@repo/db";
import { logger } from "@repo/logs";

// ** import config
import { env } from "@/config/env";

// ** import types
import type { AppEnv } from "@/types";

const execAsync = promisify(exec);
const route = new Hono<AppEnv>();

/**
 * DELETE /api/workspaces/:id
 *
 * Permanently deletes a workspace and performs aggressive physical cleanup:
 * 1. Kills any running executions (sets status = cancelled).
 * 2. Removes the git worktree and cleans orphaned worktree entries.
 * 3. Wipes the entire workspace directory from disk (including logs, caches, artifacts).
 * 4. Deletes the workspace record from the DB (cascade handles child rows via FK).
 */
route.delete("/:id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");

    // Verify ownership
    const results = await db
      .select({ workspace: workspace })
      .from(workspace)
      .innerJoin(project, eq(workspace.projectId, project.id))
      .where(and(eq(workspace.id, id), eq(project.userId, user.id)))
      .limit(1);

    if (results.length === 0) {
      return c.json({ error: "Workspace not found" }, 404);
    }

    const workspacePath = path.join(
      env.WORKSPACE_DIR || "/tmp/vibecode-workspaces",
      id,
    );
    const worktreesBasePath = path.join(
      env.WORKSPACE_DIR || "/tmp/vibecode-workspaces",
      ".worktrees",
      id,
    );

    // Step 1: Cancel any queued/running executions so the worker halts
    const runningExecs = await db
      .select({ id: execution.id })
      .from(execution)
      .where(
        and(
          eq(execution.workspaceId, id),
          inArray(execution.status, ["queued", "running"]),
        ),
      );

    if (runningExecs.length > 0) {
      const execIds = runningExecs.map((e) => e.id);
      await db
        .update(execution)
        .set({ status: "cancelled" })
        .where(inArray(execution.id, execIds));

      logger.info(
        `Workspace ${id}: cancelled ${execIds.length} in-flight execution(s) before delete`,
      );
    }

    // Step 2: Aggressive physical cleanup — worktrees + disk
    try {
      // Prune dangling worktree metadata first
      await execAsync(`git worktree prune`, { cwd: workspacePath }).catch(
        () => {},
      );

      // Force-remove all execution worktrees
      await rm(worktreesBasePath, { recursive: true, force: true });

      // Wipe the main workspace directory (all files, logs, artifact caches)
      await rm(workspacePath, { recursive: true, force: true });

      logger.info(`Workspace ${id}: physical disk cleanup completed`);
    } catch (fsErr) {
      // Non-fatal — log and continue with DB deletion
      logger.warn(
        `Workspace ${id}: partial disk cleanup failure: ${fsErr instanceof Error ? fsErr.message : String(fsErr)}`,
      );
    }

    // Step 3: Delete workspace from DB (FK cascades handle executions, artifacts, chat rows etc.)
    await db.delete(workspace).where(eq(workspace.id, id));

    logger.info(`Workspace ${id} permanently deleted`);

    return c.json({ data: { success: true, id } });
  } catch (error) {
    logger.error(
      `Failed to delete workspace: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to delete workspace" }, 500);
  }
});

export default route;
