// ** import core packages
import { Hono } from "hono";

// ** import middleware
import { authMiddleware, requireAuth } from "@/middleware/auth";

// ** import apis
import { generateQueryEmbedding, queryVectors } from "@repo/ai";

// ** import types
import type { AppEnv } from "@/types";

const searchRoute = new Hono<AppEnv>();

searchRoute.use("*", authMiddleware);
searchRoute.use("*", requireAuth);

searchRoute.post("/search", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json();
  const query = typeof body.query === "string" ? body.query.trim() : "";
  const projectId =
    typeof body.projectId === "string" ? body.projectId : undefined;

  if (!query) {
    return c.json({ error: "query is required" }, 400);
  }

  const vector = await generateQueryEmbedding(query);
  const filters = [`userId = '${user.id}'`];
  if (projectId) {
    filters.push(`projectId = '${projectId}'`);
  }

  const results = await queryVectors({
    vector,
    topK: 10,
    filter: filters.join(" AND "),
    includeMetadata: true,
    includeData: true,
  });

  return c.json({ data: results }, 200);
});

export default searchRoute;
