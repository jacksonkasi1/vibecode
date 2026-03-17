export interface Env {
  GCS_PROJECT_ID: string;
  GCS_KEY_FILE?: string;
  GCS_KEY_JSON?: string;
  GCS_BUCKET_NAME: string;
  GCS_PUBLIC_URL?: string;
}

export function createEnvFromProcessEnv(): Env {
  const projectId = process.env.GCS_PROJECT_ID;
  const keyFile = process.env.GCS_KEY_FILE;
  const keyJson = process.env.GCS_KEY_JSON;
  const bucketName = process.env.GCS_BUCKET_NAME;

  if (!projectId || !bucketName) {
    throw new Error(
      "GCS_PROJECT_ID and GCS_BUCKET_NAME environment variables are required",
    );
  }

  if (!keyFile && !keyJson) {
    throw new Error(
      "GCS_KEY_FILE or GCS_KEY_JSON environment variable is required",
    );
  }

  return {
    GCS_PROJECT_ID: projectId,
    GCS_KEY_FILE: keyFile,
    GCS_KEY_JSON: keyJson,
    GCS_BUCKET_NAME: bucketName,
    GCS_PUBLIC_URL: process.env.GCS_PUBLIC_URL,
  };
}

export interface UploadOptions {
  contentType?: string;
  organizationId?: string;
  expiresIn?: number;
}

export interface FileObject {
  key: string;
  url: string;
  size?: number;
  contentType?: string;
}

export interface ListFilesOptions {
  prefix?: string;
  maxKeys?: number;
  continuationToken?: string;
}

export interface ListFilesResult {
  files: FileObject[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}

export interface DownloadResult {
  data: Uint8Array;
  contentType?: string;
  size?: number;
}
