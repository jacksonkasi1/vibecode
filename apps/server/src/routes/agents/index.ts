// ** import core packages
import { Hono } from "hono";
import path from "node:path";

// ** import middleware
import { authMiddleware, requireAuth } from "@/middleware/auth";

// ** import agents
import { loadUserAgents, mergeUserAgents } from "@repo/ai";

// ** import config
import { env } from "@/config/env";

// ** import utils
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const agentsRouter = new Hono<AppEnv>();

agentsRouter.use("*", authMiddleware);
agentsRouter.use("*", requireAuth);

/**
 * GET /api/agents
 * Returns the merged list of built-in + user-defined agents (global scope only).
 */
agentsRouter.get("/", async (c) => {
  try {
    const userAgents = await loadUserAgents();
    const registry = mergeUserAgents(userAgents);

    const agents = Object.values(registry).map((a) => ({
      name: a.name,
      description: a.description,
      mode: a.mode,
      model: a.model ?? null,
      maxSteps: a.maxSteps,
      isUserDefined: a.isUserDefined ?? false,
    }));

    return c.json({ data: agents });
  } catch (error) {
    logger.error(
      `Failed to list agents: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to list agents" }, 500);
  }
});

/**
 * GET /api/agents/workspaces/:workspaceId
 * Returns the merged list of built-in + global user-defined + workspace-local agents.
 */
agentsRouter.get("/workspaces/:workspaceId", async (c) => {
  try {
    const workspaceId = c.req.param("workspaceId");
    const workspacePath = path.join(env.WORKSPACE_DIR, workspaceId);

    const userAgents = await loadUserAgents(workspacePath);
    const registry = mergeUserAgents(userAgents);

    const agents = Object.values(registry).map((a) => ({
      name: a.name,
      description: a.description,
      mode: a.mode,
      model: a.model ?? null,
      maxSteps: a.maxSteps,
      isUserDefined: a.isUserDefined ?? false,
    }));

    return c.json({ data: agents });
  } catch (error) {
    logger.error(
      `Failed to list workspace agents: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to list agents" }, 500);
  }
});

export default agentsRouter;
