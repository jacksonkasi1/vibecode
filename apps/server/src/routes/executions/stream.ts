// ** import core packages
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

// ** import lib
import { db } from "@repo/db";
import { execution, eq, and } from "@repo/db";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.get("/:id/stream", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const id = c.req.param("id");
  const [found] = await db
    .select()
    .from(execution)
    .where(and(eq(execution.id, id), eq(execution.userId, user.id)))
    .limit(1);

  if (!found) return c.json({ error: "Execution not found" }, 404);

  return streamSSE(c, async (stream) => {
    // Send initial status
    await stream.writeSSE({
      event: "execution:status",
      data: JSON.stringify({
        type: "execution:status",
        data: { id: found.id, status: found.status },
        timestamp: new Date().toISOString(),
      }),
    });

    // Poll for updates until execution is complete
    let currentStatus = found.status;
    const terminalStatuses = ["completed", "failed", "cancelled"];

    while (!terminalStatuses.includes(currentStatus)) {
      await new Promise((resolve) => setTimeout(resolve, 1000));

      const [updated] = await db
        .select()
        .from(execution)
        .where(eq(execution.id, id))
        .limit(1);

      if (!updated) break;

      if (updated.status !== currentStatus) {
        currentStatus = updated.status;
        await stream.writeSSE({
          event: `execution:${currentStatus}`,
          data: JSON.stringify({
            type: `execution:${currentStatus}`,
            data: {
              id: updated.id,
              status: updated.status,
              result: updated.result ? JSON.parse(updated.result) : null,
              errorMessage: updated.errorMessage,
            },
            timestamp: new Date().toISOString(),
          }),
        });
      }
    }
  });
});

export default route;
