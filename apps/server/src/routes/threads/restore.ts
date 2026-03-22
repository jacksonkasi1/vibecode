// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { chatThread, eq, and } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

/**
 * POST /api/threads/:id/restore
 * Restores a soft-deleted thread (sets deletedAt = null).
 * Used by the client-side 10-second undo stack.
 */
route.post("/:id/restore", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");

    // Verify ownership (allow even if deletedAt is set)
    const [existing] = await db
      .select()
      .from(chatThread)
      .where(and(eq(chatThread.id, id), eq(chatThread.userId, user.id)))
      .limit(1);

    if (!existing) {
      return c.json({ error: "Thread not found" }, 404);
    }

    const [restored] = await db
      .update(chatThread)
      .set({ deletedAt: null, updatedAt: new Date() })
      .where(eq(chatThread.id, id))
      .returning();

    return c.json({ data: restored });
  } catch (error) {
    logger.error(
      `Failed to restore thread: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to restore thread" }, 500);
  }
});

export default route;
