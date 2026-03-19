// ** import core packages
import { readdir, stat } from "node:fs/promises";
import path from "node:path";

// ** import types
import type { ExecutableTool } from "../tools";

function resolveSafePath(workspaceDir: string, targetPath: string): string {
  const resolved = path.resolve(workspaceDir, targetPath);
  if (!resolved.startsWith(workspaceDir)) {
    throw new Error(`Path traversal detected: ${targetPath}`);
  }
  return resolved;
}

const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".turbo",
  "dist",
  ".next",
  "build",
]);
const MAX_RESULTS = 500;

async function glob(
  rootDir: string,
  currentDir: string,
  pattern: RegExp | null,
  results: string[],
): Promise<void> {
  if (results.length >= MAX_RESULTS) return;

  const entries = await readdir(currentDir, { withFileTypes: true });

  for (const entry of entries) {
    if (results.length >= MAX_RESULTS) break;
    if (IGNORED_DIRS.has(entry.name)) continue;

    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path
      .relative(rootDir, absolutePath)
      .split(path.sep)
      .join("/");

    if (entry.isDirectory()) {
      await glob(rootDir, absolutePath, pattern, results);
      continue;
    }

    if (!entry.isFile()) continue;

    if (pattern && !pattern.test(relativePath)) continue;

    results.push(relativePath);
  }
}

function patternToRegex(pattern: string): RegExp {
  // Convert glob pattern to regex
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&")
    .replace(/\*\*/g, "{{DOUBLE_STAR}}")
    .replace(/\*/g, "[^/]*")
    .replace(/{{DOUBLE_STAR}}/g, ".*")
    .replace(/\?/g, "[^/]");
  return new RegExp(`^${escaped}$`);
}

export function createListFilesTool(workspaceDir: string): ExecutableTool {
  return {
    name: "list_files",
    description:
      "List files in the workspace recursively. Optionally filter by glob pattern (e.g. '**/*.ts', 'src/**/*.tsx'). Skips node_modules, .git, dist, and build directories.",
    parameters: {
      type: "object",
      properties: {
        dir: {
          type: "string",
          description:
            "Directory to list, relative to workspace root. Use '.' for root.",
        },
        pattern: {
          type: "string",
          description:
            "Optional glob pattern to filter files (e.g. '**/*.ts', '*.json')",
        },
      },
      required: ["dir"],
    },
    execute: async (args: Record<string, unknown>) => {
      try {
        const dirArg = (args.dir as string) || ".";
        const patternArg = args.pattern as string | undefined;

        const resolvedDir = resolveSafePath(workspaceDir, dirArg);

        const dirStat = await stat(resolvedDir).catch(() => null);
        if (!dirStat?.isDirectory()) {
          return `Error: '${dirArg}' is not a directory.`;
        }

        const regex = patternArg ? patternToRegex(patternArg) : null;
        const results: string[] = [];

        await glob(resolvedDir, resolvedDir, regex, results);

        if (results.length === 0) {
          return "No files found.";
        }

        const truncated = results.length >= MAX_RESULTS;
        const output = results.join("\n");
        return truncated
          ? `${output}\n\n[Results truncated at ${MAX_RESULTS} files]`
          : output;
      } catch (error) {
        return `Error listing files: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };
}
