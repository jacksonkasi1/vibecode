// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { workspace, project, eq, and } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.post("/:id/stop", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");

    const results = await db
      .select({ workspace: workspace })
      .from(workspace)
      .innerJoin(project, eq(workspace.projectId, project.id))
      .where(and(eq(workspace.id, id), eq(project.userId, user.id)))
      .limit(1);

    if (results.length === 0)
      return c.json({ error: "Workspace not found" }, 404);

    const ws = results[0]!.workspace;
    if (ws.status === "stopped" || ws.status === "idle") {
      return c.json({ error: "Workspace is not running" }, 409);
    }

    const [updated] = await db
      .update(workspace)
      .set({
        status: "stopped" as const,
        updatedAt: new Date(),
      })
      .where(eq(workspace.id, id))
      .returning();

    // TODO: Phase 2 — trigger actual VM/runtime stop

    return c.json({ data: updated });
  } catch (error) {
    logger.error(
      `Failed to stop workspace: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to stop workspace" }, 500);
  }
});

export default route;
