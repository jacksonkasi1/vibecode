// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { execution, eq, and } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.post("/:id/cancel", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const [found] = await db
      .select()
      .from(execution)
      .where(and(eq(execution.id, id), eq(execution.userId, user.id)))
      .limit(1);

    if (!found) return c.json({ error: "Execution not found" }, 404);

    if (found.status !== "queued" && found.status !== "running") {
      return c.json({ error: "Cannot cancel a finished execution" }, 409);
    }

    const [updated] = await db
      .update(execution)
      .set({
        status: "cancelled" as const,
        completedAt: new Date(),
      })
      .where(eq(execution.id, id))
      .returning();

    // TODO: signal worker to abort the task

    return c.json({ data: updated });
  } catch (error) {
    logger.error(
      `Failed to cancel execution: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to cancel execution" }, 500);
  }
});

export default route;
