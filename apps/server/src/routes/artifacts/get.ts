// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { artifact, execution, eq, and } from "@repo/db";
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
      .select({ artifact: artifact })
      .from(artifact)
      .innerJoin(execution, eq(artifact.executionId, execution.id))
      .where(and(eq(artifact.id, id), eq(execution.userId, user.id)))
      .limit(1);

    if (results.length === 0)
      return c.json({ error: "Artifact not found" }, 404);

    return c.json({ data: results[0]!.artifact });
  } catch (error) {
    logger.error(
      `Failed to get artifact: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to get artifact" }, 500);
  }
});

export default route;
