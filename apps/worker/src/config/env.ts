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

    // GCS Storage (for uploading artifacts)
    GCS_PROJECT_ID: z.string().min(1).optional(),
    GCS_BUCKET_NAME: z.string().min(1).optional(),
    GCS_KEY_FILE: z.string().min(1).optional(),
    GCS_KEY_JSON: z.string().min(1).optional(),
    GCS_PUBLIC_URL: z.string().url().optional(),
  },
  runtimeEnv: process.env,
  emptyStringAsUndefined: true,
});
