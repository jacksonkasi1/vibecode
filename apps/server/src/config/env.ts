// ** import core packages
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "production", "test"])
      .default("development"),
    PORT: z.string().optional(),

    BETTER_AUTH_URL: z.string().url(),
    BETTER_AUTH_SECRET: z.string().min(32),
    FRONTEND_URL: z.string().url(),
    DATABASE_URL: z.string().url(),

    ZEPTOMAIL_API_KEY: z.string().min(1).optional(),
    EMAIL_FROM_ADDRESS: z.string().email().optional(),
    EMAIL_FROM_NAME: z.string().optional(),

    ALLOWED_ORIGINS: z.string().optional(),
    DOMAIN: z.string().optional(),

    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),

    GCS_PROJECT_ID: z.string().min(1),
    GCS_BUCKET_NAME: z.string().min(1),
    GCS_KEY_FILE: z.string().min(1).optional(),
    GCS_KEY_JSON: z.string().min(1).optional(),
    GCS_PUBLIC_URL: z.string().url().optional(),

    GEMINI_API_KEY: z.string().min(1).optional(),
    UPSTASH_VECTOR_REST_URL: z.string().url().optional(),
    UPSTASH_VECTOR_REST_TOKEN: z.string().min(1).optional(),
    GITHUB_TOKEN: z.string().min(1).optional(),

    EXECUTION_DISPATCH_MODE: z
      .enum(["local_polling", "pubsub"])
      .default("local_polling"),
    PUBSUB_PROJECT_ID: z.string().optional(),
    PUBSUB_EXECUTIONS_TOPIC: z.string().optional(),
    EXECUTION_STREAM_POLL_MS: z.coerce.number().default(250),
    GCP_REGION: z.string().default("asia-south1"),
    GCP_COMPUTE_ZONE: z.string().default("asia-south1-a"),
    WORKSPACE_DIR: z.string().default("/tmp/vibecode-workspaces"),
  },

  runtimeEnv: process.env,

  emptyStringAsUndefined: true,

  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
});

export type Env = typeof env;
