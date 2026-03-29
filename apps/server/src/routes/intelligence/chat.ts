// ** import core packages
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";

// ** import middleware
import { authMiddleware, requireAuth } from "@/middleware/auth";

// ** import intelligence
import {
  assembleIntelligenceContext,
  classifyIntelligenceQuery,
  generateIntelligenceResponse,
  logIntelligenceQuery,
} from "@/intelligence";

// ** import types
import type { AppEnv } from "@/types";

const chatRoute = new Hono<AppEnv>();

chatRoute.use("*", authMiddleware);
chatRoute.use("*", requireAuth);

chatRoute.post("/chat", async (c) => {
  const user = c.get("user");
  if (!user) return c.json({ error: "Unauthorized" }, 401);

  const body = await c.req.json();
  const message = typeof body.message === "string" ? body.message.trim() : "";
  const projectId =
    typeof body.projectId === "string" ? body.projectId : undefined;

  if (!message) {
    return c.json({ error: "message is required" }, 400);
  }

  return streamSSE(c, async (stream) => {
    const startedAt = Date.now();
    const classification = await classifyIntelligenceQuery({
      message,
      projectId,
      userId: user.id,
    });

    await stream.writeSSE({
      event: "intelligence:classified",
      data: JSON.stringify({ data: classification }),
    });

    const context = await assembleIntelligenceContext({
      classification,
      message,
      userId: user.id,
    });

    await stream.writeSSE({
      event: "intelligence:context",
      data: JSON.stringify({
        data: {
          projectKnowledge: context.projectKnowledge,
          vectorMatches: context.vectorMatches.length,
          projects: context.projects.length,
        },
      }),
    });

    const answer = await generateIntelligenceResponse({
      classification,
      message,
      context,
    });

    await logIntelligenceQuery({
      userId: user.id,
      projectId: classification.projectId,
      classification,
      query: message,
      latencyMs: Date.now() - startedAt,
    }).catch(() => undefined);

    await stream.writeSSE({
      event: "intelligence:answer",
      data: JSON.stringify({ data: { answer } }),
    });
  });
});

export default chatRoute;
