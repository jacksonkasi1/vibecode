// ** import types
import type { ToolDefinition } from "@repo/ai";
import type { AgentDefinition } from "@repo/ai";

// ** import tools
import { getAgentTools } from "./tools/index";
export { getAgentTools } from "./tools/index";

export interface ExecutableTool extends ToolDefinition {
  execute: (args: Record<string, unknown>) => Promise<string>;
}

/**
 * Returns workspace tools for a given agent name.
 * Delegates to the tools/index module which handles per-agent tool sets.
 *
 * @param workspaceDir - The absolute path to the workspace directory
 * @param agentName - The agent type (orchestrator, coder, frontend, backend, etc.)
 * @param taskToolOptions - Required when agentName is "orchestrator" to enable task spawning
 */
export function getWorkspaceTools(
  workspaceDir: string,
  agentName = "default",
  taskToolOptions?: {
    rootExecutionId: string;
    workspaceId: string;
    modelId: string;
    worktreeDir: string;
    /** Merged registry of built-in + user-defined agents */
    agentRegistry: Record<string, AgentDefinition>;
  },
): ExecutableTool[] {
  return getAgentTools(workspaceDir, agentName, taskToolOptions);
}
