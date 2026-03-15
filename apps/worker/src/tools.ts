// ** import core packages
import { readFile, writeFile } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

// ** import types
import type { ToolDefinition } from "@repo/ai";

const execAsync = promisify(exec);

export interface ExecutableTool extends ToolDefinition {
  execute: (args: Record<string, unknown>) => Promise<string>;
}

// Helper to ensure we don't escape the workspace
function resolveSafePath(workspaceDir: string, targetPath: string): string {
  const resolved = path.resolve(workspaceDir, targetPath);
  if (!resolved.startsWith(workspaceDir)) {
    throw new Error(`Path traversal detected: ${targetPath}`);
  }
  return resolved;
}

export function getWorkspaceTools(workspaceDir: string): ExecutableTool[] {
  return [
    {
      name: "read_file",
      description: "Read the contents of a file in the workspace.",
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
    },
    {
      name: "write_file",
      description: "Write content to a file in the workspace.",
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

          // Ensure directory exists
          const dir = path.dirname(filePath);
          await execAsync(`mkdir -p "${dir}"`);

          await writeFile(filePath, args.content as string, "utf-8");
          return `Successfully wrote to ${args.path}`;
        } catch (error) {
          return `Error writing file: ${error instanceof Error ? error.message : String(error)}`;
        }
      },
    },
    {
      name: "execute_command",
      description: "Execute a bash command in the workspace.",
      parameters: {
        type: "object",
        properties: {
          command: {
            type: "string",
            description: "The bash command to run",
          },
        },
        required: ["command"],
      },
      execute: async (args: Record<string, unknown>) => {
        try {
          const { stdout, stderr } = await execAsync(args.command as string, {
            cwd: workspaceDir,
            timeout: 30000, // 30s timeout
          });

          let output = "";
          if (stdout) output += `STDOUT:\n${stdout}\n`;
          if (stderr) output += `STDERR:\n${stderr}\n`;

          return output || "Command executed successfully with no output.";
        } catch (error: any) {
          return `Command failed:\n${error.message}\nSTDOUT:\n${error.stdout}\nSTDERR:\n${error.stderr}`;
        }
      },
    },
  ];
}
