// ** import core packages
import { and, db, desc, eq, newId } from "@repo/db";

// ** import schema
import { decisionLog, execution, project, projectKnowledge } from "@repo/db";

// ** import apis
import {
  analyzeRepository,
  detectProjectProfile,
  generateEmbeddings,
  indexRepositoryFiles,
  upsertVectors,
} from "@repo/ai";

// ** import utils
import { logger } from "@repo/logs";

// ** import intelligence
import {
  getGithubFileContent,
  getGithubLatestCommit,
  getGithubTree,
  parseGithubRepositoryUrl,
} from "./github";

type ScanProjectInput = {
  projectId: string;
  userId: string;
};

async function getOwnedProject(input: ScanProjectInput) {
  const [ownedProject] = await db
    .select()
    .from(project)
    .where(
      and(eq(project.id, input.projectId), eq(project.userId, input.userId)),
    )
    .limit(1);

  return ownedProject ?? null;
}

export async function getProjectKnowledgeRecord(input: ScanProjectInput) {
  const [knowledge] = await db
    .select()
    .from(projectKnowledge)
    .where(eq(projectKnowledge.projectId, input.projectId))
    .limit(1);

  return knowledge ?? null;
}

export async function getProjectKnowledgeStatus(input: ScanProjectInput) {
  const ownedProject = await getOwnedProject(input);
  if (!ownedProject) {
    throw new Error("Project not found");
  }

  const knowledge = await getProjectKnowledgeRecord(input);
  const repoRef = ownedProject.repositoryUrl
    ? parseGithubRepositoryUrl(ownedProject.repositoryUrl)
    : null;

  let latestCommit: string | null = null;
  if (repoRef) {
    latestCommit = await getGithubLatestCommit({
      ...repoRef,
      branch: ownedProject.defaultBranch ?? "main",
    }).catch(() => null);
  }

  return {
    project: ownedProject,
    knowledge,
    latestCommit,
    isScanned: Boolean(knowledge),
    isStale: Boolean(
      knowledge && latestCommit && knowledge.lastScannedCommit !== latestCommit,
    ),
  };
}

export async function scanProjectKnowledge(input: ScanProjectInput) {
  const ownedProject = await getOwnedProject(input);
  if (!ownedProject) {
    throw new Error("Project not found");
  }

  if (!ownedProject.repositoryUrl) {
    throw new Error("Project is missing repositoryUrl");
  }

  const repoRef = parseGithubRepositoryUrl(ownedProject.repositoryUrl);
  if (!repoRef) {
    throw new Error("Only GitHub repository URLs are supported");
  }

  const branch = ownedProject.defaultBranch ?? "main";
  const treeResult = await getGithubTree({ ...repoRef, branch });
  const lightweightFiles = treeResult.tree.map((path) => ({ path }));
  const detected = detectProjectProfile(lightweightFiles);

  const keyFiles = await Promise.all(
    detected.importantFiles.slice(0, 12).map(async (path) => ({
      path,
      content:
        (await getGithubFileContent({ ...repoRef, branch, path }).catch(
          () => null,
        )) ?? undefined,
    })),
  );

  const enrichedProfile = detectProjectProfile(keyFiles);
  const analysis = await analyzeRepository({
    name: ownedProject.name,
    framework: enrichedProfile.framework,
    language: enrichedProfile.language,
    packageManager: enrichedProfile.packageManager,
    filePaths: treeResult.tree,
    keyFiles: keyFiles
      .filter((file): file is { path: string; content: string } =>
        Boolean(file.content),
      )
      .slice(0, 8),
  });

  const knowledgeId = (await getProjectKnowledgeRecord(input))?.id ?? newId();

  const [savedKnowledge] = await db
    .insert(projectKnowledge)
    .values({
      id: knowledgeId,
      projectId: ownedProject.id,
      framework: enrichedProfile.framework,
      language: enrichedProfile.language,
      packageManager: enrichedProfile.packageManager,
      monorepo: enrichedProfile.monorepo ? "true" : "false",
      monorepoTool: enrichedProfile.monorepoTool,
      architectureSummary: analysis.architectureSummary,
      fileStructureSummary: analysis.fileStructureSummary,
      conventionsSummary: analysis.conventionsSummary,
      repositoryOwner: repoRef.owner,
      repositoryName: repoRef.repo,
      repositoryBranch: branch,
      lastScannedAt: new Date(),
      lastScannedCommit: treeResult.commitSha,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: projectKnowledge.projectId,
      set: {
        framework: enrichedProfile.framework,
        language: enrichedProfile.language,
        packageManager: enrichedProfile.packageManager,
        monorepo: enrichedProfile.monorepo ? "true" : "false",
        monorepoTool: enrichedProfile.monorepoTool,
        architectureSummary: analysis.architectureSummary,
        fileStructureSummary: analysis.fileStructureSummary,
        conventionsSummary: analysis.conventionsSummary,
        repositoryOwner: repoRef.owner,
        repositoryName: repoRef.repo,
        repositoryBranch: branch,
        lastScannedAt: new Date(),
        lastScannedCommit: treeResult.commitSha,
        updatedAt: new Date(),
      },
    })
    .returning();

  const indexedChunks = await indexRepositoryFiles(keyFiles);
  const summaryEmbeddings = await generateEmbeddings([
    analysis.architectureSummary,
    analysis.fileStructureSummary,
    analysis.conventionsSummary,
  ]);

  await upsertVectors([
    ...indexedChunks.map((chunk) => ({
      id: `${ownedProject.id}:${chunk.id}`,
      vector: chunk.vector,
      data: chunk.content,
      metadata: {
        projectId: ownedProject.id,
        userId: input.userId,
        type: "code_structure" as const,
        source: chunk.path,
        filePath: chunk.path,
        summary: chunk.summary,
        commitSha: treeResult.commitSha,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    })),
    {
      id: `${ownedProject.id}:architecture`,
      vector: summaryEmbeddings[0]?.vector ?? [],
      data: analysis.architectureSummary,
      metadata: {
        projectId: ownedProject.id,
        userId: input.userId,
        type: "architecture",
        source: "project_knowledge",
        summary: analysis.architectureSummary.slice(0, 180),
        commitSha: treeResult.commitSha,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
    {
      id: `${ownedProject.id}:conventions`,
      vector: summaryEmbeddings[2]?.vector ?? [],
      data: analysis.conventionsSummary,
      metadata: {
        projectId: ownedProject.id,
        userId: input.userId,
        type: "convention",
        source: "project_knowledge",
        summary: analysis.conventionsSummary.slice(0, 180),
        commitSha: treeResult.commitSha,
        createdAt: Date.now(),
        updatedAt: Date.now(),
      },
    },
  ]).catch((error) => {
    logger.warn(
      `Failed to upsert project knowledge vectors: ${error instanceof Error ? error.message : String(error)}`,
    );
  });

  const [latestExecution] = await db
    .select({ id: execution.id, completedAt: execution.completedAt })
    .from(execution)
    .where(eq(execution.userId, input.userId))
    .orderBy(desc(execution.createdAt))
    .limit(1);

  await db.insert(decisionLog).values({
    id: newId(),
    projectId: ownedProject.id,
    userId: input.userId,
    executionId: latestExecution?.id ?? null,
    decision: `Scanned project knowledge for ${ownedProject.name}`,
    rationale: "Project intelligence refresh",
    outcome: "success",
    category: "architecture",
  });

  return savedKnowledge;
}
