// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { modelConfig, eq } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.get("/", async (c) => {
  try {
    const providerId = c.req.query("providerId");

    const query = providerId
      ? db
          .select()
          .from(modelConfig)
          .where(eq(modelConfig.providerId, providerId))
      : db.select().from(modelConfig);

    const models = await query.orderBy(modelConfig.displayName);

    return c.json({ data: models });
  } catch (error) {
    logger.error(
      `Failed to list models: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to list models" }, 500);
  }
});

export default route;
