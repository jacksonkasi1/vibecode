// ** import utils
import { createR2Client } from "./client";

// ** import types
import type {
  Env,
  FileObject,
  ListFilesOptions,
  ListFilesResult,
} from "./types";

export async function r2ListFiles(
  env: Env,
  options?: ListFilesOptions,
): Promise<ListFilesResult> {
  const client = createR2Client(env);
  const bucket = client.bucket(env.GCS_BUCKET_NAME);

  const [objects, nextQuery] = await bucket.getFiles({
    prefix: options?.prefix,
    maxResults: options?.maxKeys || 100,
    pageToken: options?.continuationToken,
    autoPaginate: false,
  });

  const files: FileObject[] =
    objects.map(
      (item: { name: string; metadata: { size?: string | number } }) => ({
        key: item.name,
        url: env.GCS_PUBLIC_URL
          ? `${env.GCS_PUBLIC_URL}/${item.name}`
          : item.name,
        size:
          typeof item.metadata.size === "string"
            ? Number.parseInt(item.metadata.size, 10)
            : item.metadata.size,
      }),
    ) || [];

  return {
    files,
    isTruncated: Boolean(nextQuery?.pageToken),
    nextContinuationToken: nextQuery?.pageToken,
  };
}

export async function r2FileExists(
  filePath: string,
  env: Env,
): Promise<boolean> {
  const client = createR2Client(env);
  const bucket = client.bucket(env.GCS_BUCKET_NAME);

  try {
    const [exists] = await bucket.file(filePath).exists();
    if (!exists) return false;
    return true;
  } catch (error) {
    throw error;
  }
}
