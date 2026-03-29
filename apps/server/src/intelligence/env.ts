// ** import database
import { and, db, eq, projectEnv, projectSecretRef } from "@repo/db";

export async function getProjectRuntimeEnv(projectId: string) {
  const [envRows, secretRows] = await Promise.all([
    db.select().from(projectEnv).where(eq(projectEnv.projectId, projectId)),
    db
      .select()
      .from(projectSecretRef)
      .where(eq(projectSecretRef.projectId, projectId)),
  ]);

  return {
    env: Object.fromEntries(envRows.map((row) => [row.key, row.value])),
    secretRefs: secretRows.map((row) => ({
      keyName: row.keyName,
      secretPath: row.secretPath,
    })),
  };
}
