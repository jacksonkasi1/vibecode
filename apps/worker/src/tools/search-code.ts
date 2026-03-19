// ** import core packages
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

// ** import types
import type { ExecutableTool } from "../tools";

const execAsync = promisify(exec);

function resolveSafePath(workspaceDir: string, targetPath: string): string {
  const resolved = path.resolve(workspaceDir, targetPath);
  if (!resolved.startsWith(workspaceDir)) {
    throw new Error(`Path traversal detected: ${targetPath}`);
  }
  return resolved;
}

export function createSearchCodeTool(workspaceDir: string): ExecutableTool {
  return {
    name: "search_code",
    description:
      "Search for a regex pattern across files in the workspace. Returns matching file paths and line numbers with surrounding context. Similar to grep -r.",
    parameters: {
      type: "object",
      properties: {
        query: {
          type: "string",
          description: "The regex pattern or plain text to search for",
        },
        path: {
          type: "string",
          description:
            "Optional path to search within (relative to workspace root). Defaults to '.' (entire workspace).",
        },
        file_pattern: {
          type: "string",
          description:
            "Optional glob pattern to restrict which files are searched (e.g. '*.ts', '*.tsx')",
        },
      },
      required: ["query"],
    },
    execute: async (args: Record<string, unknown>) => {
      try {
        const query = String(args.query || "").trim();
        if (!query) return "Error: query is required.";

        const searchPath = args.path
          ? resolveSafePath(workspaceDir, args.path as string)
          : workspaceDir;

        const filePattern = args.file_pattern
          ? `--include="${args.file_pattern}"`
          : "";

        // Use grep with context, exclude node_modules and .git
        const command = [
          "grep",
          "-r",
          "-n",
          "--color=never",
          "-E",
          "--exclude-dir=node_modules",
          "--exclude-dir=.git",
          "--exclude-dir=dist",
          "--exclude-dir=.turbo",
          filePattern,
          "-m",
          "50", // max 50 matches per file
          `"${query.replace(/"/g, '\\"')}"`,
          `"${searchPath}"`,
        ]
          .filter(Boolean)
          .join(" ");

        const { stdout, stderr } = await execAsync(command, {
          cwd: workspaceDir,
          timeout: 30_000,
        }).catch((err: any) => ({
          stdout: err.stdout || "",
          stderr: err.stderr || "",
        }));

        if (!stdout.trim()) {
          return `No matches found for: ${query}`;
        }

        // Make paths relative to workspace
        const relativeOutput = stdout
          .split("\n")
          .map((line: string) =>
            line
              .replace(workspaceDir + path.sep, "")
              .replace(workspaceDir + "/", ""),
          )
          .join("\n")
          .trim();

        const lineCount = relativeOutput.split("\n").length;
        const truncation =
          lineCount >= 200 ? "\n[Output truncated at 200 lines]" : "";

        return relativeOutput.split("\n").slice(0, 200).join("\n") + truncation;
      } catch (error) {
        return `Error searching code: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };
}
