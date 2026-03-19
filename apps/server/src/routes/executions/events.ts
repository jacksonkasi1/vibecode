// ** import core packages
import { Hono } from "hono";

// ** import database
import { and, asc, db, eq, execution, executionEvent } from "@repo/db";

// ** import utils
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.get("/:id/events", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const executionId = c.req.param("id");
    const [found] = await db
      .select({ id: execution.id })
      .from(execution)
      .where(and(eq(execution.id, executionId), eq(execution.userId, user.id)))
      .limit(1);

    if (!found) return c.json({ error: "Execution not found" }, 404);

    const events = await db
      .select()
      .from(executionEvent)
      .where(eq(executionEvent.executionId, executionId))
      .orderBy(asc(executionEvent.seq));

    return c.json({ data: events });
  } catch (error) {
    logger.error(
      `Failed to fetch execution events: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to fetch events" }, 500);
  }
});

export default route;
