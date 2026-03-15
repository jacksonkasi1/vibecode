// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { project, eq } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.get("/:id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const [found] = await db
      .select()
      .from(project)
      .where(eq(project.id, id))
      .limit(1);

    if (!found) return c.json({ error: "Project not found" }, 404);
    if (found.userId !== user.id) return c.json({ error: "Forbidden" }, 403);

    return c.json({ data: found });
  } catch (error) {
    logger.error(
      `Failed to get project: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to get project" }, 500);
  }
});

export default route;
