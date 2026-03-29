// ** import core packages
import { Hono } from "hono";

// ** import middleware
import { authMiddleware, requireAuth } from "@/middleware/auth";

// ** import intelligence
import {
  getProjectKnowledgeRecord,
  getProjectKnowledgeStatus,
  scanProjectKnowledge,
} from "@/intelligence";

// ** import utils
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const intelligenceProjectsRouter = new Hono<AppEnv>();

intelligenceProjectsRouter.use("*", authMiddleware);
intelligenceProjectsRouter.use("*", requireAuth);

intelligenceProjectsRouter.post("/projects/:projectId/scan", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const knowledge = await scanProjectKnowledge({
      projectId,
      userId: user.id,
    });
    return c.json({ data: knowledge }, 200);
  } catch (error) {
    logger.error(
      `Failed to scan project knowledge: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to scan project knowledge" }, 500);
  }
});

intelligenceProjectsRouter.get("/projects/:projectId/knowledge", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.param("projectId");
    const knowledge = await getProjectKnowledgeRecord({
      projectId,
      userId: user.id,
    });

    if (!knowledge) {
      return c.json({ error: "Project knowledge not found" }, 404);
    }

    return c.json({ data: knowledge }, 200);
  } catch (error) {
    logger.error(
      `Failed to get project knowledge: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to get project knowledge" }, 500);
  }
});

intelligenceProjectsRouter.get(
  "/projects/:projectId/knowledge/status",
  async (c) => {
    try {
      const user = c.get("user");
      if (!user) return c.json({ error: "Unauthorized" }, 401);

      const projectId = c.req.param("projectId");
      const status = await getProjectKnowledgeStatus({
        projectId,
        userId: user.id,
      });
      return c.json({ data: status }, 200);
    } catch (error) {
      logger.error(
        `Failed to get project knowledge status: ${error instanceof Error ? error.message : String(error)}`,
      );
      return c.json({ error: "Failed to get project knowledge status" }, 500);
    }
  },
);

export default intelligenceProjectsRouter;
