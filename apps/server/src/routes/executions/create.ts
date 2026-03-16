// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import {
  and,
  asc,
  chatMessage,
  chatThread,
  desc,
  eq,
  execution,
  executionEvent,
  project,
  workspace,
} from "@repo/db";
import { newId } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

// ** import utils
import { dispatchExecutionQueued } from "@/lib/execution-dispatch";

const route = new Hono<AppEnv>();

route.post("/", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const { workspaceId, prompt, modelId } = body;

    if (!workspaceId) return c.json({ error: "workspaceId is required" }, 400);
    if (!prompt || typeof prompt !== "string") {
      return c.json({ error: "Prompt is required" }, 400);
    }

    // Verify workspace access through project ownership
    const results = await db
      .select({ workspace: workspace })
      .from(workspace)
      .innerJoin(project, eq(workspace.projectId, project.id))
      .where(and(eq(workspace.id, workspaceId), eq(project.userId, user.id)))
      .limit(1);

    if (results.length === 0) {
      return c.json({ error: "Workspace not found or access denied" }, 404);
    }

    const [existingThread] = await db
      .select()
      .from(chatThread)
      .where(
        and(
          eq(chatThread.workspaceId, workspaceId),
          eq(chatThread.userId, user.id),
        ),
      )
      .orderBy(desc(chatThread.updatedAt), asc(chatThread.createdAt))
      .limit(1);

    const threadId = existingThread?.id ?? newId();
    const executionId = newId();

    const [created] = await db.transaction(async (tx) => {
      if (!existingThread) {
        await tx.insert(chatThread).values({
          id: threadId,
          workspaceId,
          userId: user.id,
          title: null,
        });
      }

      await tx.insert(chatMessage).values({
        id: newId(),
        threadId,
        role: "user",
        contentJson: {
          parts: [{ type: "text", text: prompt }],
        },
      });

      const [createdExecution] = await tx
        .insert(execution)
        .values({
          id: executionId,
          workspaceId,
          userId: user.id,
          prompt,
          modelId: modelId || null,
          status: "queued",
        })
        .returning();

      await tx.insert(executionEvent).values({
        id: newId(),
        executionId,
        seq: 1,
        type: "status",
        payloadJson: {
          status: "queued",
          queuedAt: new Date().toISOString(),
        },
      });

      await tx
        .update(chatThread)
        .set({ updatedAt: new Date() })
        .where(eq(chatThread.id, threadId));

      return [createdExecution] as const;
    });

    await dispatchExecutionQueued({
      executionId: created.id,
      workspaceId: created.workspaceId,
      userId: created.userId,
    });

    return c.json({ data: created }, 201);
  } catch (error) {
    logger.error(
      `Failed to create execution: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to create execution" }, 500);
  }
});

export default route;
