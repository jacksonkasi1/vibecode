// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { workspace, project, eq, and } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.patch("/:id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");

    // Verify ownership through project
    const results = await db
      .select({ workspace: workspace })
      .from(workspace)
      .innerJoin(project, eq(workspace.projectId, project.id))
      .where(and(eq(workspace.id, id), eq(project.userId, user.id)))
      .limit(1);

    if (results.length === 0)
      return c.json({ error: "Workspace not found" }, 404);

    const body = await c.req.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.branch !== undefined) updates.branch = body.branch;
    if (body.metadata !== undefined)
      updates.metadata = JSON.stringify(body.metadata);

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(workspace)
      .set(updates)
      .where(eq(workspace.id, id))
      .returning();

    return c.json({ data: updated });
  } catch (error) {
    logger.error(
      `Failed to update workspace: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to update workspace" }, 500);
  }
});

export default route;
