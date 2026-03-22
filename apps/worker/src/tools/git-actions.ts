// ** import core packages
import { exec } from "node:child_process";
import { promisify } from "node:util";

// ** import types
import type { ExecutableTool } from "../tools";

const execAsync = promisify(exec);

export function createGitActionsTool(workspaceDir: string): ExecutableTool[] {
  const run = async (cmd: string) => {
    const { stdout, stderr } = await execAsync(cmd, {
      cwd: workspaceDir,
      timeout: 30_000,
    });
    let output = "";
    if (stdout.trim()) output += stdout.trim();
    if (stderr.trim())
      output += (output ? "\n" : "") + `STDERR: ${stderr.trim()}`;
    return output || "Done.";
  };

  const gitStatus: ExecutableTool = {
    name: "git_status",
    description:
      "Show the working tree status — which files are modified, staged, or untracked.",
    parameters: {
      type: "object",
      properties: {},
      required: [],
    },
    execute: async () => {
      try {
        return await run("git status --short");
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };

  const gitDiff: ExecutableTool = {
    name: "git_diff",
    description:
      "Show the diff of changes. Pass staged=true to see staged changes only.",
    parameters: {
      type: "object",
      properties: {
        staged: {
          type: "boolean",
          description:
            "If true, show staged (--cached) diff. Default: false (shows unstaged).",
        },
        path: {
          type: "string",
          description: "Optional file path to diff",
        },
      },
      required: [],
    },
    execute: async (args: Record<string, unknown>) => {
      try {
        const staged = args.staged ? "--cached" : "";
        const filePath = args.path ? `"${args.path}"` : "";
        return await run(`git diff ${staged} ${filePath}`.trim());
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };

  const gitAdd: ExecutableTool = {
    name: "git_add",
    description:
      "Stage files for commit. Pass paths as an array or '.' to stage all.",
    parameters: {
      type: "object",
      properties: {
        paths: {
          type: "array",
          items: { type: "string" },
          description: "File paths to stage. Use ['.'] to stage all changes.",
        },
      },
      required: ["paths"],
    },
    execute: async (args: Record<string, unknown>) => {
      try {
        const paths = Array.isArray(args.paths) ? args.paths : ["."];
        const quoted = paths.map((p: string) => `"${p}"`).join(" ");
        return await run(`git add ${quoted}`);
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };

  const gitCommit: ExecutableTool = {
    name: "git_commit",
    description: "Create a git commit with the given message.",
    parameters: {
      type: "object",
      properties: {
        message: {
          type: "string",
          description: "The commit message",
        },
      },
      required: ["message"],
    },
    execute: async (args: Record<string, unknown>) => {
      try {
        const message = String(args.message || "").replace(/"/g, '\\"');
        return await run(`git commit -m "${message}"`);
      } catch (error) {
        return `Error: ${error instanceof Error ? error.message : String(error)}`;
      }
    },
  };

  return [gitStatus, gitDiff, gitAdd, gitCommit];
}
