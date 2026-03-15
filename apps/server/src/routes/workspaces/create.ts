// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { workspace, project, eq, and } from "@repo/db";
import { newId } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.post("/", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const { projectId, name, branch } = body;

    if (!projectId) return c.json({ error: "projectId is required" }, 400);
    if (!name || typeof name !== "string") {
      return c.json({ error: "Name is required" }, 400);
    }

    // Verify project ownership
    const [proj] = await db
      .select()
      .from(project)
      .where(and(eq(project.id, projectId), eq(project.userId, user.id)))
      .limit(1);

    if (!proj)
      return c.json({ error: "Project not found or access denied" }, 404);

    const id = newId();
    const [created] = await db
      .insert(workspace)
      .values({
        id,
        projectId,
        name,
        branch: branch || proj.defaultBranch || "main",
        status: "idle",
      })
      .returning();

    return c.json({ data: created }, 201);
  } catch (error) {
    logger.error(
      `Failed to create workspace: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to create workspace" }, 500);
  }
});

export default route;
