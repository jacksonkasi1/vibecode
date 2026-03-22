// ** import core packages
import { readFile } from "node:fs/promises";
import path from "node:path";

// ** import types
import type { ExecutableTool } from "../tools";

// Helper to ensure we don't escape the workspace
function resolveSafePath(workspaceDir: string, targetPath: string): string {
  const resolved = path.resolve(workspaceDir, targetPath);
  if (!resolved.startsWith(workspaceDir)) {
    throw new Error(`Path traversal detected: ${targetPath}`);
  }
  return resolved;
}

export function createReadFileTool(workspaceDir: string): ExecutableTool {
  return {
    name: "read_file",
    description:
      "Read the contents of a file in the workspace. Returns the file content as text.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path relative to the workspace root",
        },
      },
      required: ["path"],
    },
    execute: async (args: Record<string, unknown>) => {
      try {
        const filePath = resolveSafePath(workspaceDir, args.path as string);
        const content = await readFile(filePath, "utf-8");
        return content;
      } catch (error) {
        return `Error reading file: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };
}
