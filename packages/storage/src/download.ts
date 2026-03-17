// ** import utils
import { createR2Client } from "./client";

// ** import types
import type { DownloadResult, Env } from "./types";

export async function r2GetSignedDownloadUrl(
  filePath: string,
  env: Env,
  options?: { expiresIn?: number },
): Promise<string> {
  const client = createR2Client(env);
  const bucket = client.bucket(env.GCS_BUCKET_NAME);
  const file = bucket.file(filePath);

  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "read",
    expires: Date.now() + (options?.expiresIn || 3600) * 1000,
  });

  return signedUrl;
}

export async function r2DownloadFile(
  filePath: string,
  env: Env,
): Promise<DownloadResult> {
  const client = createR2Client(env);
  const bucket = client.bucket(env.GCS_BUCKET_NAME);
  const file = bucket.file(filePath);
  const [exists] = await file.exists();

  if (!exists) {
    throw new Error(`File not found: ${filePath}`);
  }

  const [data] = await file.download();
  const [metadata] = await file.getMetadata();

  return {
    data: Uint8Array.from(data),
    contentType: metadata.contentType,
    size:
      typeof metadata.size === "string"
        ? Number.parseInt(metadata.size, 10)
        : metadata.size,
  };
}
