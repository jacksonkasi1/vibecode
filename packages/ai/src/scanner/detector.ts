// ** import types
import type { ChunkedContent } from "../embeddings";

export interface RepositoryFile {
  path: string;
  content?: string;
}

export interface DetectedProjectProfile {
  framework: string | null;
  language: string | null;
  packageManager: string | null;
  monorepo: boolean;
  monorepoTool: string | null;
  importantFiles: string[];
}

function hasPath(paths: string[], matcher: RegExp | string) {
  if (typeof matcher === "string") {
    return paths.includes(matcher);
  }

  return paths.some((path) => matcher.test(path));
}

function detectPackageManager(paths: string[]) {
  if (hasPath(paths, "bun.lock") || hasPath(paths, "bun.lockb")) return "bun";
  if (hasPath(paths, "pnpm-lock.yaml")) return "pnpm";
  if (hasPath(paths, "yarn.lock")) return "yarn";
  if (hasPath(paths, "package-lock.json")) return "npm";
  return null;
}

function detectMonorepoTool(paths: string[]) {
  if (hasPath(paths, "turbo.json")) return "turborepo";
  if (hasPath(paths, "nx.json")) return "nx";
  if (hasPath(paths, "lerna.json")) return "lerna";
  return null;
}

function detectFramework(paths: string[], packageJsonContent?: string) {
  const packageJson = packageJsonContent ?? "";

  if (packageJson.includes('"next"')) return "next";
  if (
    packageJson.includes('"react"') &&
    hasPath(paths, /vite\.config\.(ts|js|mts|mjs)$/)
  ) {
    return "react-vite";
  }
  if (packageJson.includes('"hono"')) return "hono";
  if (packageJson.includes('"express"')) return "express";
  if (packageJson.includes('"react-native"')) return "react-native";
  return null;
}

function detectLanguage(paths: string[]) {
  if (paths.some((path) => path.endsWith(".ts") || path.endsWith(".tsx"))) {
    return "typescript";
  }
  if (paths.some((path) => path.endsWith(".js") || path.endsWith(".jsx"))) {
    return "javascript";
  }
  if (paths.some((path) => path.endsWith(".py"))) {
    return "python";
  }
  return null;
}

export function selectImportantFiles(paths: string[]) {
  const preferredPatterns = [
    /^README\.md$/i,
    /^package\.json$/,
    /^tsconfig.*\.json$/,
    /^turbo\.json$/,
    /^drizzle\.config\.(ts|js|mts|mjs)$/,
    /^apps\/server\/src\/index\.ts$/,
    /^apps\/worker\/src\/runner\.ts$/,
    /^apps\/web\/src\//,
    /^packages\/db\/src\/schema\//,
    /^src\/routes\//,
    /^src\/index\.(ts|js)$/,
  ];

  return paths.filter((path) =>
    preferredPatterns.some((pattern) => pattern.test(path)),
  );
}

export function detectProjectProfile(files: RepositoryFile[]) {
  const paths = files.map((file) => file.path);
  const packageJsonContent = files.find(
    (file) => file.path === "package.json",
  )?.content;
  const monorepoTool = detectMonorepoTool(paths);

  return {
    framework: detectFramework(paths, packageJsonContent),
    language: detectLanguage(paths),
    packageManager: detectPackageManager(paths),
    monorepo: Boolean(
      monorepoTool ||
      paths.some(
        (path) => path.startsWith("apps/") || path.startsWith("packages/"),
      ),
    ),
    monorepoTool,
    importantFiles: selectImportantFiles(paths),
  } satisfies DetectedProjectProfile;
}

export function summarizeFileTree(paths: string[], limit = 40) {
  return paths.slice(0, limit).join("\n");
}

export function buildChunkSources(files: RepositoryFile[]) {
  return files
    .filter(
      (file) =>
        typeof file.content === "string" && file.content.trim().length > 0,
    )
    .map((file) => ({
      path: file.path,
      content: file.content as string,
    }));
}

export type ScannerChunk = ChunkedContent;
