// ** import types
import type { ExecutableTool } from "../tools";

// ** import agents
import type { AgentDefinition } from "@repo/ai";

// ** import tools
import { createReadFileTool } from "./read-file";
import { createWriteFileTool } from "./write-file";
import { createExecuteCommandTool } from "./execute-command";
import { createListFilesTool } from "./list-files";
import { createSearchCodeTool } from "./search-code";
import { createGitActionsTool } from "./git-actions";
import { createTaskTool, createParallelTasksTool } from "./task-tool";

export type AgentToolSet =
  | "orchestrator"
  | "coder"
  | "frontend"
  | "backend"
  | "tester"
  | "researcher"
  | "debugger"
  | "default";

interface TaskToolOptions {
  rootExecutionId: string;
  workspaceId: string;
  modelId: string;
  worktreeDir: string;
  /** Merged registry of built-in + user-defined agents */
  agentRegistry: Record<string, AgentDefinition>;
}

/**
 * Returns the appropriate tool set for a given agent type.
 *
 * - orchestrator: read-only (list, search, read) + task tool
 * - coder/frontend/backend/tester: all tools
 * - researcher: read-only (list, search, read)
 * - debugger: all tools
 * - default: all tools (read, write, execute)
 */
export function getAgentTools(
  workspaceDir: string,
  agentName: string,
  taskToolOptions?: TaskToolOptions,
): ExecutableTool[] {
  const readFile = createReadFileTool(workspaceDir);
  const writeFile = createWriteFileTool(workspaceDir);
  const executeCommand = createExecuteCommandTool(workspaceDir);
  const listFiles = createListFilesTool(workspaceDir);
  const searchCode = createSearchCodeTool(workspaceDir);
  const gitTools = createGitActionsTool(workspaceDir);

  switch (agentName) {
    case "orchestrator": {
      const tools: ExecutableTool[] = [listFiles, searchCode, readFile];
      if (taskToolOptions) {
        tools.push(
          createTaskTool(
            taskToolOptions.rootExecutionId,
            taskToolOptions.workspaceId,
            taskToolOptions.modelId,
            taskToolOptions.worktreeDir,
            taskToolOptions.agentRegistry,
          ),
          createParallelTasksTool(
            taskToolOptions.rootExecutionId,
            taskToolOptions.workspaceId,
            taskToolOptions.modelId,
            taskToolOptions.worktreeDir,
            taskToolOptions.agentRegistry,
          ),
        );
      }
      return tools;
    }

    case "researcher":
      return [listFiles, searchCode, readFile];

    case "tester":
      return [
        readFile,
        writeFile,
        executeCommand,
        listFiles,
        searchCode,
        ...gitTools,
      ];

    case "frontend":
    case "backend":
    case "coder":
    case "debugger":
    default:
      return [
        readFile,
        writeFile,
        executeCommand,
        listFiles,
        searchCode,
        ...gitTools,
      ];
  }
}
