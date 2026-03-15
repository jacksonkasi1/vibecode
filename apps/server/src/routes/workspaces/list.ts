// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { workspace, project, eq, and } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.get("/", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.query("projectId");

    if (projectId) {
      // Verify project ownership
      const [proj] = await db
        .select()
        .from(project)
        .where(and(eq(project.id, projectId), eq(project.userId, user.id)))
        .limit(1);

      if (!proj) return c.json({ error: "Project not found" }, 404);

      const workspaces = await db
        .select()
        .from(workspace)
        .where(eq(workspace.projectId, projectId))
        .orderBy(workspace.createdAt);

      return c.json({ data: workspaces });
    }

    // Get all workspaces for user's projects
    const workspaces = await db
      .select({ workspace: workspace })
      .from(workspace)
      .innerJoin(project, eq(workspace.projectId, project.id))
      .where(eq(project.userId, user.id))
      .orderBy(workspace.createdAt);

    return c.json({ data: workspaces.map((w) => w.workspace) });
  } catch (error) {
    logger.error(
      `Failed to list workspaces: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to list workspaces" }, 500);
  }
});

export default route;
