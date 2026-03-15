// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { workspace, project, execution, eq, and } from "@repo/db";
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
    const { workspaceId, prompt, modelId } = body;

    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    if (!prompt || typeof prompt !== "string") {
      return c.json({ error: "Prompt is required" }, 400);
    }

    // Verify workspace access through project ownership
    const results = await db
      .select({ workspace: workspace })
      .from(workspace)
      .innerJoin(project, eq(workspace.projectId, project.id))
      .where(and(eq(workspace.id, workspaceId), eq(project.userId, user.id)))
      .limit(1);

    if (results.length === 0) {
      return c.json({ error: "Workspace not found or access denied" }, 404);
    }

    const id = newId();
    const [created] = await db
      .insert(execution)
      .values({
        id,
        workspaceId,
        userId: user.id,
        prompt,
        modelId: modelId || null,
        status: "queued",
      })
      .returning();

    // TODO: Phase 1 — notify worker to pick up the task

    return c.json({ data: created }, 201);
  } catch (error) {
    logger.error(
      `Failed to create execution: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to create execution" }, 500);
  }
});

export default route;
