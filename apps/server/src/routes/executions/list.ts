// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { workspace, project, execution, eq, and } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.get("/", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const workspaceId = c.req.query("workspaceId");

    if (workspaceId) {
      // Verify workspace ownership
      const wsCheck = await db
        .select()
        .from(workspace)
        .innerJoin(project, eq(workspace.projectId, project.id))
        .where(and(eq(workspace.id, workspaceId), eq(project.userId, user.id)))
        .limit(1);

      if (wsCheck.length === 0) {
        return c.json({ error: "Workspace not found" }, 404);
      }

      const executions = await db
        .select()
        .from(execution)
        .where(eq(execution.workspaceId, workspaceId))
        .orderBy(execution.createdAt);

      return c.json({ data: executions });
    }

    // Get all executions for this user
    const executions = await db
      .select()
      .from(execution)
      .where(eq(execution.userId, user.id))
      .orderBy(execution.createdAt);

    return c.json({ data: executions });
  } catch (error) {
    logger.error(
      `Failed to list executions: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to list executions" }, 500);
  }
});

export default route;
