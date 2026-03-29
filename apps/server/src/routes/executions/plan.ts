// ** import core packages
import { Hono } from "hono";

// ** import database
import {
  and,
  appendExecutionEventRecord,
  asc,
  db,
  eq,
  execution,
  executionEvent,
} from "@repo/db";

// ** import utils
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.get("/:id/plan", async (c) => {
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

    const planEvents = await db
      .select()
      .from(executionEvent)
      .where(eq(executionEvent.executionId, executionId))
      .orderBy(asc(executionEvent.seq))
      .limit(200);

    const planEvent = planEvents.find((event) => event.type === "plan");

    if (!planEvent) {
      return c.json({ error: "Plan not available yet" }, 404);
    }

    const modifications = planEvents
      .filter((event) => event.type === "plan:modified")
      .map((event) => event.payloadJson);
    const approvals = planEvents.filter(
      (event) => event.type === "plan:approved",
    );

    return c.json(
      {
        data: {
          plan: planEvent.payloadJson,
          modifications,
          approved: approvals.length > 0,
          approvedAt:
            approvals.length > 0
              ? approvals[approvals.length - 1]?.payloadJson
              : null,
        },
      },
      200,
    );
  } catch (error) {
    logger.error(
      `Failed to fetch execution plan: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to fetch execution plan" }, 500);
  }
});

route.post("/:id/plan/approve", async (c) => {
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

    await appendExecutionEventRecord({
      executionId,
      type: "plan:approved",
      payloadJson: { approvedAt: new Date().toISOString() },
    });

    return c.json({ ok: true }, 200);
  } catch (error) {
    logger.error(
      `Failed to approve execution plan: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to approve execution plan" }, 500);
  }
});

route.post("/:id/plan/modify", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const executionId = c.req.param("id");
    const body = await c.req.json();
    const note = typeof body.note === "string" ? body.note : "";

    if (!note) {
      return c.json({ error: "note is required" }, 400);
    }

    const [found] = await db
      .select({ id: execution.id })
      .from(execution)
      .where(and(eq(execution.id, executionId), eq(execution.userId, user.id)))
      .limit(1);

    if (!found) return c.json({ error: "Execution not found" }, 404);

    await appendExecutionEventRecord({
      executionId,
      type: "plan:modified",
      payloadJson: { note, modifiedAt: new Date().toISOString() },
    });

    return c.json({ ok: true }, 200);
  } catch (error) {
    logger.error(
      `Failed to modify execution plan: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to modify execution plan" }, 500);
  }
});

export default route;
