// ** import core packages
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

// ** import lib
import { db } from "@repo/db";
import { and, asc, eq, execution, executionEvent, gt } from "@repo/db";

// ** import types
import type { AppEnv } from "@/types";

// ** import config
import { env } from "@/config/env";

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

  const headerCursor = Number(
    c.req.header("last-event-id") ?? c.req.header("Last-Event-ID"),
  );
  const queryCursor = Number(c.req.query("cursor"));
  let lastSeq = Number.isFinite(queryCursor)
    ? queryCursor
    : Number.isFinite(headerCursor)
      ? headerCursor
      : 0;
  if (!Number.isFinite(lastSeq) || lastSeq < 0) lastSeq = 0;

  return streamSSE(c, async (stream) => {
    let aborted = false;
    stream.onAbort(() => {
      aborted = true;
    });

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
    const terminalStatuses = ["completed", "conflicted", "failed", "cancelled"];

    if (terminalStatuses.includes(currentStatus)) {
      const existingEventRows = await db
        .select()
        .from(executionEvent)
        .where(
          and(
            eq(executionEvent.executionId, id),
            gt(executionEvent.seq, lastSeq),
          ),
        )
        .orderBy(asc(executionEvent.seq));

      for (const row of existingEventRows) {
        if (row.type === "editor:context") {
          lastSeq = row.seq;
          continue;
        }

        lastSeq = row.seq;
        await stream.writeSSE({
          id: String(row.seq),
          event: "execution:event",
          data: JSON.stringify({
            type: "execution:event",
            data: {
              executionId: row.executionId,
              seq: row.seq,
              eventType: row.type,
              payload: row.payloadJson,
            },
            timestamp: new Date().toISOString(),
          }),
        });
      }

      await stream.writeSSE({
        event: `execution:${currentStatus}`,
        data: JSON.stringify({
          type: `execution:${currentStatus}`,
          data: {
            id: found.id,
            status: found.status,
            result: found.result ? JSON.parse(found.result) : null,
            errorMessage: found.errorMessage,
          },
          timestamp: new Date().toISOString(),
        }),
      });

      return;
    }

    while (!aborted) {
      const eventRows = await db
        .select()
        .from(executionEvent)
        .where(
          and(
            eq(executionEvent.executionId, id),
            gt(executionEvent.seq, lastSeq),
          ),
        )
        .orderBy(asc(executionEvent.seq));

      for (const row of eventRows) {
        if (row.type === "editor:context") {
          lastSeq = row.seq;
          continue;
        }

        lastSeq = row.seq;
        await stream.writeSSE({
          id: String(row.seq),
          event: "execution:event",
          data: JSON.stringify({
            type: "execution:event",
            data: {
              executionId: row.executionId,
              seq: row.seq,
              eventType: row.type,
              payload: row.payloadJson,
            },
            timestamp: new Date().toISOString(),
          }),
        });
      }

      await new Promise((resolve) =>
        setTimeout(resolve, env.EXECUTION_STREAM_POLL_MS),
      );

      if (aborted) break;

      const [updated] = await db
        .select()
        .from(execution)
        .where(eq(execution.id, id))
        .limit(1);

      if (!updated) break;

      const statusChanged = updated.status !== currentStatus;

      if (statusChanged) {
        currentStatus = updated.status;
      }

      if (terminalStatuses.includes(currentStatus)) {
        const trailingEventRows = await db
          .select()
          .from(executionEvent)
          .where(
            and(
              eq(executionEvent.executionId, id),
              gt(executionEvent.seq, lastSeq),
            ),
          )
          .orderBy(asc(executionEvent.seq));

        for (const row of trailingEventRows) {
          if (row.type === "editor:context") {
            lastSeq = row.seq;
            continue;
          }

          lastSeq = row.seq;
          await stream.writeSSE({
            id: String(row.seq),
            event: "execution:event",
            data: JSON.stringify({
              type: "execution:event",
              data: {
                executionId: row.executionId,
                seq: row.seq,
                eventType: row.type,
                payload: row.payloadJson,
              },
              timestamp: new Date().toISOString(),
            }),
          });
        }

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

        break;
      }

      if (statusChanged) {
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
