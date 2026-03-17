// ** import core packages
import { Hono } from "hono";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

// ** import lib
import { db } from "@repo/db";
import { execution, workspace, eq, and } from "@repo/db";
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
    const workspacePath = path.join(env.WORKSPACE_DIR || "/tmp/vibecode-workspaces", execRecord.workspaceId);

    // Find the merge commit for this execution
    const { stdout: commitsLog } = await execAsync(`git log --grep="Merge execution ${id}" --format="%H" -n 1`, { cwd: workspacePath }).catch(() => ({ stdout: "" }));
    
    const targetCommitHash = commitsLog.trim();
    
    if (targetCommitHash) {
      // Revert the merge commit securely (-m 1 means keep the mainline parent)
      await withWorkspaceLock(env.WORKSPACE_DIR || "/tmp/vibecode-workspaces", execRecord.workspaceId, async () => {
        try {
          await execAsync(`git revert -m 1 ${targetCommitHash} --no-edit`, { cwd: workspacePath });
          logger.info(`Workspace ${execRecord.workspaceId} reverted execution ${id} via git revert`);
        } catch (error) {
          await execAsync(`git revert --abort`, { cwd: workspacePath }).catch(() => {});
          throw new Error(`Revert failed due to conflicts: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
    } else {
      logger.warn(`Could not find git merge commit for execution ${id}`);
    }

    return c.json({ data: { success: true } });
  } catch (error) {
    logger.error(
      `Failed to undo execution: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to undo execution" }, 500);
  }
});

export default route;
