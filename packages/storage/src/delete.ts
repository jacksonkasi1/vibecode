// ** import utils
import { createR2Client } from "./client";

// ** import types
import type { Env } from "./types";

export async function r2DeleteFile(
  filePath: string,
  env: Env,
): Promise<{ success: boolean }> {
  const client = createR2Client(env);
  const bucket = client.bucket(env.GCS_BUCKET_NAME);
  await bucket.file(filePath).delete();
  return { success: true };
}

export async function r2DeleteFileByUrl(
  fileUrl: string,
  env: Env,
): Promise<{ success: boolean }> {
  let filePath: string;

  if (env.GCS_PUBLIC_URL && fileUrl.startsWith(env.GCS_PUBLIC_URL)) {
    filePath = fileUrl.replace(env.GCS_PUBLIC_URL, "").replace(/^\//, "");
  } else {
    // Parse URL to extract pathname
    try {
      const url = new URL(fileUrl);
      filePath = url.pathname.replace(/^\//, "");
    } catch {
      throw new Error(`Invalid file URL: ${fileUrl}`);
    }
  }

  if (!filePath) {
    throw new Error("Could not extract file path from URL");
  }

  return r2DeleteFile(filePath, env);
}

export async function r2DeleteMultipleFiles(
  filePaths: string[],
  env: Env,
): Promise<{ success: boolean; deleted: number }> {
  if (filePaths.length === 0) {
    return { success: true, deleted: 0 };
  }

  const client = createR2Client(env);
  const bucket = client.bucket(env.GCS_BUCKET_NAME);
  const settled = await Promise.allSettled(
    filePaths.map((filePath) => bucket.file(filePath).delete()),
  );
  const deleted = settled.filter(
    (entry) => entry.status === "fulfilled",
  ).length;

  return {
    success: true,
    deleted,
  };
}
