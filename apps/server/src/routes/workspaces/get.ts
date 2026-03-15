// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { workspace, project, eq, and } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.get("/:id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const results = await db
      .select({ workspace: workspace, project: project })
      .from(workspace)
      .innerJoin(project, eq(workspace.projectId, project.id))
      .where(and(eq(workspace.id, id), eq(project.userId, user.id)))
      .limit(1);

    if (results.length === 0)
      return c.json({ error: "Workspace not found" }, 404);

    return c.json({ data: results[0]!.workspace });
  } catch (error) {
    logger.error(
      `Failed to get workspace: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to get workspace" }, 500);
  }
});

export default route;
