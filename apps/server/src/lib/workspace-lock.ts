import { mkdir, rmdir } from "node:fs/promises";
import path from "node:path";

export async function withWorkspaceLock<T>(
  workspaceDir: string,
  workspaceId: string,
  fn: () => Promise<T>,
): Promise<T> {
  const lockDir = path.join(workspaceDir, `.lock-${workspaceId}`);
  let retries = 0;

  while (true) {
    try {
      // mkdir without 'recursive' is atomic and throws EEXIST if it exists
      await mkdir(lockDir);
      break;
    } catch (err: any) {
      if (err.code !== "EEXIST") throw err;
      if (++retries > 300) {
        throw new Error(
          `Timeout acquiring workspace git lock for ${workspaceId}`,
        );
      }
      await new Promise((r) => setTimeout(r, 100)); // wait 100ms
    }
  }

  try {
    return await fn();
  } finally {
    await rmdir(lockDir).catch(() => {});
  }
}
