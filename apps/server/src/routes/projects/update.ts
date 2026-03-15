// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { project, eq } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.patch("/:id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const [existing] = await db
      .select()
      .from(project)
      .where(eq(project.id, id))
      .limit(1);

    if (!existing) return c.json({ error: "Project not found" }, 404);
    if (existing.userId !== user.id) return c.json({ error: "Forbidden" }, 403);

    const body = await c.req.json();
    const updates: Record<string, unknown> = {};

    if (body.name !== undefined) updates.name = body.name;
    if (body.description !== undefined) updates.description = body.description;
    if (body.repositoryUrl !== undefined)
      updates.repositoryUrl = body.repositoryUrl;
    if (body.defaultBranch !== undefined)
      updates.defaultBranch = body.defaultBranch;
    if (body.status !== undefined) updates.status = body.status;

    updates.updatedAt = new Date();

    const [updated] = await db
      .update(project)
      .set(updates)
      .where(eq(project.id, id))
      .returning();

    return c.json({ data: updated });
  } catch (error) {
    logger.error(
      `Failed to update project: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to update project" }, 500);
  }
});

export default route;
