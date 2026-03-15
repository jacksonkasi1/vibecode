// ** import packages
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    DATABASE_URL: z.string().url(),
    WORKSPACE_DIR: z.string().default("/tmp/vibecode-workspaces"),
    GEMINI_API_KEY: z.string().min(1).optional(),
    POLL_INTERVAL_MS: z.coerce.number().default(2000),
    
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
