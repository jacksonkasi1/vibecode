// ** import core packages
import { Hono } from "hono";

// ** import lib
import { db } from "@repo/db";
import { modelProvider } from "@repo/db";
import { logger } from "@repo/logs";

// ** import types
import type { AppEnv } from "@/types";

const route = new Hono<AppEnv>();

route.get("/providers", async (c) => {
  try {
    const providers = await db
      .select()
      .from(modelProvider)
      .orderBy(modelProvider.name);

    return c.json({ data: providers });
  } catch (error) {
    logger.error(
      `Failed to list providers: ${error instanceof Error ? error.message : String(error)}`,
    );
    return c.json({ error: "Failed to list providers" }, 500);
  }
});

export default route;
