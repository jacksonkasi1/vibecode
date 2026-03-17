// ** import core packages
import { Storage } from "@google-cloud/storage";

// ** import types
import type { Env } from "./types";

export function createR2Client(env: Env): Storage {
  const credentials = env.GCS_KEY_JSON
    ? JSON.parse(env.GCS_KEY_JSON)
    : undefined;

  return new Storage({
    projectId: env.GCS_PROJECT_ID,
    keyFilename: env.GCS_KEY_FILE,
    credentials,
  });
}
