// ** import core packages
import { Hono } from "hono";

// ** import database
import { db } from "@repo/db";
import { agentTask, execution, and, eq, asc } from "@repo/db";

// ** import utils
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

/**
 * GET /api/executions/:id/agents
 * List all agent tasks spawned by an execution.
 */
route.get("/:id/agents", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");

    // Verify the execution belongs to this user
    const [found] = await db
      .select({ id: execution.id })
      .from(execution)
      .where(and(eq(execution.id, id), eq(execution.userId, user.id)))
      .limit(1);

    if (!found) return c.json({ error: "Execution not found" }, 404);

    const tasks = await db
      .select()
      .from(agentTask)
      .where(eq(agentTask.executionId, id))
      .orderBy(asc(agentTask.createdAt));

    return c.json({ data: tasks });
  } catch (error) {
    logger.error(
      `Failed to list agent tasks: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to list agent tasks" }, 500);
  }
});

/**
 * GET /api/executions/:id/agents/:taskId
 * Get a specific agent task by ID.
 */
route.get("/:id/agents/:taskId", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const taskId = c.req.param("taskId");

    // Verify the execution belongs to this user
    const [found] = await db
      .select({ id: execution.id })
      .from(execution)
      .where(and(eq(execution.id, id), eq(execution.userId, user.id)))
      .limit(1);

    if (!found) return c.json({ error: "Execution not found" }, 404);

    const [task] = await db
      .select()
      .from(agentTask)
      .where(and(eq(agentTask.id, taskId), eq(agentTask.executionId, id)))
      .limit(1);

    if (!task) return c.json({ error: "Agent task not found" }, 404);

    return c.json({ data: task });
  } catch (error) {
    logger.error(
      `Failed to get agent task: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to get agent task" }, 500);
  }
});

export default route;
