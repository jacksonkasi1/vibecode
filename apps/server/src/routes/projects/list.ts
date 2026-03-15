// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { project, eq } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.get("/", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projects = await db
      .select()
      .from(project)
      .where(eq(project.userId, user.id))
      .orderBy(project.createdAt);

    return c.json({ data: projects });
  } catch (error) {
    logger.error(
      `Failed to list projects: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to list projects" }, 500);
  }
});

export default route;
