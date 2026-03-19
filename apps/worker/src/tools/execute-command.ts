// ** import core packages
import { exec } from "node:child_process";
import { promisify } from "node:util";

// ** import types
import type { ExecutableTool } from "../tools";

const execAsync = promisify(exec);

const LONG_RUNNING_PATTERN =
  /(vite\s+dev|npm\s+run\s+dev|bun\s+run\s+dev|next\s+dev|python\s+-m\s+http\.server|serve\s+-s)/i;

export function createExecuteCommandTool(workspaceDir: string): ExecutableTool {
  return {
    name: "execute_command",
    description:
      "Execute a bash command in the workspace directory. Returns stdout and stderr. Timeout is 60 seconds.",
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
        const command = String(args.command || "").trim();
        if (!command) return "Command failed: empty command.";

        if (LONG_RUNNING_PATTERN.test(command)) {
          return "Command blocked: long-running dev servers are not supported. Run a non-blocking verification command instead (e.g., build, lint, test, ls, or file check).";
        }

        const { stdout, stderr } = await execAsync(command, {
          cwd: workspaceDir,
          timeout: 60_000,
        });

        let output = "";
        if (stdout) output += `STDOUT:\n${stdout}\n`;
        if (stderr) output += `STDERR:\n${stderr}\n`;

        return output || "Command executed successfully with no output.";
      } catch (error: any) {
        return `Command failed:\n${error.message}\nSTDOUT:\n${error.stdout || ""}\nSTDERR:\n${error.stderr || ""}`;
      }
    },
  };
}
