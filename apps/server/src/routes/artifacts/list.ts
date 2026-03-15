// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { artifact, execution, eq, and } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.get("/", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const executionId = c.req.query("executionId");

    if (!executionId) {
      return c.json({ error: "executionId query parameter is required" }, 400);
    }

    // Verify execution ownership
    const [exec] = await db
      .select()
      .from(execution)
      .where(and(eq(execution.id, executionId), eq(execution.userId, user.id)))
      .limit(1);

    if (!exec) return c.json({ error: "Execution not found" }, 404);

    const artifacts = await db
      .select()
      .from(artifact)
      .where(eq(artifact.executionId, executionId))
      .orderBy(artifact.createdAt);

    return c.json({ data: artifacts });
  } catch (error) {
    logger.error(
      `Failed to list artifacts: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to list artifacts" }, 500);
  }
});

export default route;
