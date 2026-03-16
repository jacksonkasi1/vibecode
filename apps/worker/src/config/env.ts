// ** import packages
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

const booleanFromString = z
  .union([z.boolean(), z.string()])
  .transform((value) => {
    if (typeof value === "boolean") return value;
    return value.toLowerCase() === "true";
  });

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().url(),
    WORKSPACE_DIR: z.string().default("/tmp/vibecode-workspaces"),
    GEMINI_API_KEY: z.string().min(1).optional(),
    POLL_INTERVAL_MS: z.coerce.number().default(500),
    WORKER_DISPATCH_MODE: z.enum(["poller", "pubsub"]).default("poller"),
    PUBSUB_PROJECT_ID: z.string().optional(),
    PUBSUB_EXECUTIONS_SUBSCRIPTION: z.string().optional(),
    PUBSUB_ENABLE_POLLER_FALLBACK: booleanFromString.default(true),

    // R2 Storage (for uploading artifacts)
    R2_ACCESS_KEY_ID: z.string().min(1).optional(),
    R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
    R2_ENDPOINT_URL: z.string().url().optional(),
    R2_BUCKET_NAME: z.string().min(1).optional(),
    R2_PUBLIC_URL: z.string().url().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
