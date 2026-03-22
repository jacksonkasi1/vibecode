// ** import types
import type { TokenUsage } from "../types";

export type AgentMode = "primary" | "subagent" | "all";

export interface AgentDefinition {
  name: string;
  description: string;
  mode: AgentMode;
  systemPrompt: string;
  maxSteps: number;
  model?: string;
  /** true when loaded from a user .md file rather than the built-in registry */
  isUserDefined?: boolean;
}

export interface AgentTask {
  taskId: string;
  executionId: string;
  workspaceId: string;
  agentName: string;
  prompt: string;
  description: string;
  parentTaskId?: string;
  fileOwnership?: string[];
}

export interface AgentResult {
  taskId: string;
  agentName: string;
  output: string;
  success: boolean;
  errorMessage?: string;
  steps: number;
  usage: TokenUsage;
}

export type TaskClassification = "single" | "multi";
