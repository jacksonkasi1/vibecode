// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { project, eq } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.delete("/:id", async (c) => {
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

    const [deleted] = await db
      .update(project)
      .set({ status: "deleted" as const, updatedAt: new Date() })
      .where(eq(project.id, id))
      .returning();

    return c.json({ data: deleted });
  } catch (error) {
    logger.error(
      `Failed to delete project: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to delete project" }, 500);
  }
});

export default route;
