// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { chatThread, eq, and } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.delete("/:id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");

    // Verify ownership
    const [existing] = await db
      .select()
      .from(chatThread)
      .where(and(eq(chatThread.id, id), eq(chatThread.userId, user.id)))
      .limit(1);

    if (!existing) {
      return c.json({ error: "Thread not found" }, 404);
    }

    // Soft delete
    const [deleted] = await db
      .update(chatThread)
      .set({ deletedAt: new Date(), updatedAt: new Date() })
      .where(eq(chatThread.id, id))
      .returning();

    return c.json({ data: deleted });
  } catch (error) {
    logger.error(
      `Failed to delete thread: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to delete thread" }, 500);
  }
});

export default route;
