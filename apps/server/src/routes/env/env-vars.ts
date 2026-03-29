// ** import core packages
import { Hono } from "hono";

// ** import database
import { and, db, eq, newId, project, projectEnv } from "@repo/db";

// ** import middleware
import { authMiddleware, requireAuth } from "@/middleware/auth";

// ** import utils
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.use("*", authMiddleware);
route.use("*", requireAuth);

route.get("/vars", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.query("projectId");
    if (!projectId) return c.json({ error: "projectId is required" }, 400);

    const rows = await db
      .select({
        id: projectEnv.id,
        projectId: projectEnv.projectId,
        key: projectEnv.key,
        value: projectEnv.value,
        description: projectEnv.description,
        createdAt: projectEnv.createdAt,
        updatedAt: projectEnv.updatedAt,
      })
      .from(projectEnv)
      .innerJoin(project, eq(projectEnv.projectId, project.id))
      .where(and(eq(project.id, projectId), eq(project.userId, user.id)));

    return c.json({ data: rows });
  } catch (error) {
    logger.error(
      `Failed to list project env vars: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to list project env vars" }, 500);
  }
});

route.post("/vars", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const key = typeof body.key === "string" ? body.key : "";
    const value = typeof body.value === "string" ? body.value : "";
    const description =
      typeof body.description === "string" ? body.description : null;

    if (!projectId || !key) {
      return c.json({ error: "projectId and key are required" }, 400);
    }

    const [ownedProject] = await db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.id, projectId), eq(project.userId, user.id)))
      .limit(1);

    if (!ownedProject) return c.json({ error: "Project not found" }, 404);

    const [saved] = await db
      .insert(projectEnv)
      .values({
        id: newId(),
        projectId,
        key,
        value,
        description,
      })
      .onConflictDoUpdate({
        target: [projectEnv.projectId, projectEnv.key],
        set: {
          value,
          description,
          updatedAt: new Date(),
        },
      })
      .returning();

    return c.json({ data: saved }, 201);
  } catch (error) {
    logger.error(
      `Failed to save project env var: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to save project env var" }, 500);
  }
});

route.patch("/vars/:id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const body = await c.req.json();
    const value = typeof body.value === "string" ? body.value : "";
    const description =
      typeof body.description === "string" ? body.description : null;

    const [existing] = await db
      .select({ id: projectEnv.id })
      .from(projectEnv)
      .innerJoin(project, eq(projectEnv.projectId, project.id))
      .where(and(eq(projectEnv.id, id), eq(project.userId, user.id)))
      .limit(1);

    if (!existing) return c.json({ error: "Env var not found" }, 404);

    const [updated] = await db
      .update(projectEnv)
      .set({ value, description, updatedAt: new Date() })
      .where(eq(projectEnv.id, id))
      .returning();

    return c.json({ data: updated });
  } catch (error) {
    logger.error(
      `Failed to update project env var: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to update project env var" }, 500);
  }
});

route.delete("/vars/:id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const [existing] = await db
      .select({ id: projectEnv.id })
      .from(projectEnv)
      .innerJoin(project, eq(projectEnv.projectId, project.id))
      .where(and(eq(projectEnv.id, id), eq(project.userId, user.id)))
      .limit(1);

    if (!existing) return c.json({ error: "Env var not found" }, 404);

    await db.delete(projectEnv).where(eq(projectEnv.id, id));
    return c.json({ ok: true });
  } catch (error) {
    logger.error(
      `Failed to delete project env var: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to delete project env var" }, 500);
  }
});

export default route;
