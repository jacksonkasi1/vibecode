// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { project } from "@repo/db";
import { newId } from "@repo/db";
import { logger } from "@repo/logs";

// ** import intelligence
import { scanProjectKnowledge } from "@/intelligence";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.post("/", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const { name, description, repositoryUrl, defaultBranch } = body;

    if (!name || typeof name !== "string") {
      return c.json({ error: "Name is required" }, 400);
    }

    const id = newId();
    const [created] = await db
      .insert(project)
      .values({
        id,
        name,
        description: description || null,
        repositoryUrl: repositoryUrl || null,
        defaultBranch: defaultBranch || "main",
        userId: user.id,
        status: "active",
      })
      .returning();

    if (created.repositoryUrl) {
      void scanProjectKnowledge({
        projectId: created.id,
        userId: user.id,
      }).catch((scanError) => {
        logger.warn(
          `Project created but knowledge scan failed: ${scanError instanceof Error ? scanError.message : String(scanError)}`,
        );
      });
    }

    return c.json({ data: created }, 201);
  } catch (error) {
    logger.error(
      `Failed to create project: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to create project" }, 500);
  }
});

export default route;
