// ** import core packages
import { writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

// ** import types
import type { ExecutableTool } from "../tools";

const execAsync = promisify(exec);

// Helper to ensure we don't escape the workspace
function resolveSafePath(workspaceDir: string, targetPath: string): string {
  const resolved = path.resolve(workspaceDir, targetPath);
  if (!resolved.startsWith(workspaceDir)) {
    throw new Error(`Path traversal detected: ${targetPath}`);
  }
  return resolved;
}

export function createWriteFileTool(workspaceDir: string): ExecutableTool {
  return {
    name: "write_file",
    description:
      "Write content to a file in the workspace. Creates parent directories automatically.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description: "Path relative to the workspace root",
        },
        content: {
          type: "string",
          description: "The content to write to the file",
        },
      },
      required: ["path", "content"],
    },
    execute: async (args: Record<string, unknown>) => {
      try {
        const filePath = resolveSafePath(workspaceDir, args.path as string);
        const dir = path.dirname(filePath);
        await execAsync(`mkdir -p "${dir}"`);
        await writeFile(filePath, args.content as string, "utf-8");
        return `Successfully wrote to ${args.path}`;
      } catch (error) {
        return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };
}
