// ** import core packages
import { Hono } from "hono";

// ** import database
import { and, db, eq, newId, project, projectSecretRef } from "@repo/db";

// ** import middleware
import { authMiddleware, requireAuth } from "@/middleware/auth";

// ** import utils
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.use("*", authMiddleware);
route.use("*", requireAuth);

route.get("/secrets", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const projectId = c.req.query("projectId");
    if (!projectId) return c.json({ error: "projectId is required" }, 400);

    const rows = await db
      .select({
        id: projectSecretRef.id,
        projectId: projectSecretRef.projectId,
        keyName: projectSecretRef.keyName,
        secretPath: projectSecretRef.secretPath,
        description: projectSecretRef.description,
        createdAt: projectSecretRef.createdAt,
        updatedAt: projectSecretRef.updatedAt,
      })
      .from(projectSecretRef)
      .innerJoin(project, eq(projectSecretRef.projectId, project.id))
      .where(and(eq(project.id, projectId), eq(project.userId, user.id)));

    return c.json({ data: rows });
  } catch (error) {
    logger.error(
      `Failed to list project secrets: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to list project secrets" }, 500);
  }
});

route.post("/secrets", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const body = await c.req.json();
    const projectId = typeof body.projectId === "string" ? body.projectId : "";
    const keyName = typeof body.keyName === "string" ? body.keyName : "";
    const secretPath =
      typeof body.secretPath === "string" ? body.secretPath : "";
    const description =
      typeof body.description === "string" ? body.description : null;

    if (!projectId || !keyName || !secretPath) {
      return c.json(
        { error: "projectId, keyName, and secretPath are required" },
        400,
      );
    }

    const [ownedProject] = await db
      .select({ id: project.id })
      .from(project)
      .where(and(eq(project.id, projectId), eq(project.userId, user.id)))
      .limit(1);

    if (!ownedProject) return c.json({ error: "Project not found" }, 404);

    const [saved] = await db
      .insert(projectSecretRef)
      .values({
        id: newId(),
        projectId,
        keyName,
        secretPath,
        description,
      })
      .onConflictDoUpdate({
        target: [projectSecretRef.projectId, projectSecretRef.keyName],
        set: {
          secretPath,
          description,
          updatedAt: new Date(),
        },
      })
      .returning();

    return c.json({ data: saved }, 201);
  } catch (error) {
    logger.error(
      `Failed to save project secret: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to save project secret" }, 500);
  }
});

route.delete("/secrets/:id", async (c) => {
  try {
    const user = c.get("user");
    if (!user) return c.json({ error: "Unauthorized" }, 401);

    const id = c.req.param("id");
    const [existing] = await db
      .select({ id: projectSecretRef.id })
      .from(projectSecretRef)
      .innerJoin(project, eq(projectSecretRef.projectId, project.id))
      .where(and(eq(projectSecretRef.id, id), eq(project.userId, user.id)))
      .limit(1);

    if (!existing) return c.json({ error: "Secret reference not found" }, 404);

    await db.delete(projectSecretRef).where(eq(projectSecretRef.id, id));
    return c.json({ ok: true });
  } catch (error) {
    logger.error(
      `Failed to delete project secret: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to delete project secret" }, 500);
  }
});

export default route;
