// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { chatThread, workspace, project, eq, and, desc } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.get("/", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const workspaceId = c.req.query("workspaceId");

    if (!workspaceId) {
      return c.json({ error: "workspaceId query parameter is required" }, 400);
    }

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

    const threads = await db
      .select()
      .from(chatThread)
      .where(eq(chatThread.workspaceId, workspaceId))
      .orderBy(desc(chatThread.updatedAt));

    return c.json({ data: threads });
  } catch (error) {
    logger.error(
      `Failed to list threads: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to list threads" }, 500);
  }
});

export default route;
