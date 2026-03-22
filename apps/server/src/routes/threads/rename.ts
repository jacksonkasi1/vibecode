// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { chatThread, eq, and } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.patch("/:id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const body = await c.req.json();
    const { title } = body;

    if (!title || typeof title !== "string") {
      return c.json({ error: "Title is required" }, 400);
    }

    // Verify ownership
    const [existing] = await db
      .select()
      .from(chatThread)
      .where(and(eq(chatThread.id, id), eq(chatThread.userId, user.id)))
      .limit(1);

    if (!existing) {
      return c.json({ error: "Thread not found" }, 404);
    }

    const [updated] = await db
      .update(chatThread)
      .set({ title, updatedAt: new Date() })
      .where(eq(chatThread.id, id))
      .returning();

    return c.json({ data: updated });
  } catch (error) {
    logger.error(
      `Failed to rename thread: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to rename thread" }, 500);
  }
});

export default route;
