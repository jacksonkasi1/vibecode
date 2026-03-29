// ** import core packages
import { Hono } from "hono";

// ** import database
import {
  and,
  chatThread,
  db,
  desc,
  eq,
  execution,
  executionEvent,
  newId,
  taskContinuation,
} from "@repo/db";

// ** import middleware
import { authMiddleware, requireAuth } from "@/middleware/auth";

// ** import utils
import { dispatchExecutionQueued } from "@/lib/execution-dispatch";

import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.use("*", authMiddleware);
route.use("*", requireAuth);

route.get("/continuations", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const rows = await db
      .select()
      .from(taskContinuation)
      .where(eq(taskContinuation.userId, user.id))
      .orderBy(desc(taskContinuation.updatedAt));

    return c.json({ data: rows });
  } catch (error) {
    logger.error(
      `Failed to list continuations: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to list continuations" }, 500);
  }
});

route.post("/continuations/:id/resume", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const [continuation] = await db
      .select()
      .from(taskContinuation)
      .where(
        and(eq(taskContinuation.id, id), eq(taskContinuation.userId, user.id)),
      )
      .limit(1);

    if (!continuation) return c.json({ error: "Continuation not found" }, 404);

    if (!continuation.workspaceId) {
      return c.json({ error: "Continuation has no workspace to resume" }, 400);
    }

    const workspaceId = continuation.workspaceId;

    const state =
      continuation.stateJson && typeof continuation.stateJson === "object"
        ? (continuation.stateJson as Record<string, unknown>)
        : {};

    const prompt =
      typeof state.prompt === "string"
        ? `${state.prompt}\n\nResume from continuation: ${continuation.contextSummary ?? continuation.title}`
        : `Resume work: ${continuation.contextSummary ?? continuation.title}`;

    const executionId = newId();
    const threadId = newId();

    await db.transaction(async (tx) => {
      await tx.insert(chatThread).values({
        id: threadId,
        workspaceId,
        userId: user.id,
        title: continuation.title,
      });

      await tx.insert(execution).values({
        id: executionId,
        workspaceId,
        userId: user.id,
        threadId,
        prompt,
        status: "queued",
      });

      await tx.insert(executionEvent).values({
        id: newId(),
        executionId,
        seq: 1,
        type: "status",
        payloadJson: {
          status: "queued",
          queuedAt: new Date().toISOString(),
          resumedFromContinuationId: continuation.id,
        },
      });

      await tx
        .update(taskContinuation)
        .set({ updatedAt: new Date() })
        .where(eq(taskContinuation.id, continuation.id));
    });

    await dispatchExecutionQueued({
      executionId,
      workspaceId,
      userId: user.id,
    });

    return c.json({
      data: {
        continuation,
        executionId,
        threadId,
        prompt,
      },
    });
  } catch (error) {
    logger.error(
      `Failed to resume continuation: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to resume continuation" }, 500);
  }
});

route.delete("/continuations/:id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const [updated] = await db
      .update(taskContinuation)
      .set({ status: "abandoned", updatedAt: new Date() })
      .where(
        and(eq(taskContinuation.id, id), eq(taskContinuation.userId, user.id)),
      )
      .returning();

    if (!updated) return c.json({ error: "Continuation not found" }, 404);

    return c.json({ data: updated });
  } catch (error) {
    logger.error(
      `Failed to abandon continuation: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to abandon continuation" }, 500);
  }
});

export default route;
