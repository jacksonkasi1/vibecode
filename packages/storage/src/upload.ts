// ** import core packages
import { nanoid } from "nanoid";

// ** import utils
import { createR2Client } from "./client";

// ** import types
import type { Env, FileObject, UploadOptions } from "./types";

function generateFilePath(fileName: string, organizationId?: string): string {
  const timestamp = Date.now();
  const uniqueId = nanoid(8);
  const sanitizedName = fileName
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .replace(/^\.+/, "") // Remove leading dots
    .replace(/\.{2,}/g, "."); // Collapse consecutive dots
  const prefix = organizationId ? `uploads/${organizationId}` : "uploads";
  return `${prefix}/${timestamp}-${uniqueId}-${sanitizedName}`;
}

export async function r2GetSignedUploadUrl(
  fileName: string,
  env: Env,
  options?: UploadOptions,
): Promise<{ signedUrl: string; filePath: string }> {
  const client = createR2Client(env);
  const bucket = client.bucket(env.GCS_BUCKET_NAME);
  const filePath = generateFilePath(fileName, options?.organizationId);
  const file = bucket.file(filePath);

  const [signedUrl] = await file.getSignedUrl({
    version: "v4",
    action: "write",
    expires: Date.now() + (options?.expiresIn || 3600) * 1000,
    contentType: options?.contentType,
  });

  return { signedUrl, filePath };
}

export async function r2UploadBuffer(
  buffer: Buffer | Uint8Array,
  fileName: string,
  env: Env,
  options?: UploadOptions,
): Promise<FileObject> {
  const client = createR2Client(env);
  const bucket = client.bucket(env.GCS_BUCKET_NAME);
  const filePath = generateFilePath(fileName, options?.organizationId);
  const file = bucket.file(filePath);

  await file.save(buffer, {
    metadata: {
      contentType: options?.contentType,
    },
  });

  const url = env.GCS_PUBLIC_URL
    ? `${env.GCS_PUBLIC_URL}/${filePath}`
    : filePath;

  return {
    key: filePath,
    url,
    size: buffer.length,
    contentType: options?.contentType,
  };
}
