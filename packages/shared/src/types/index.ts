// Shared types for FlowStack

export interface FlowStackConfig {
  name: string;
  version: string;
}

export interface ApiResponse<T> {
  data: T;
  error: string | null;
  status: number;
}

// ** Project types
export const PROJECT_STATUSES = ["active", "archived", "deleted"] as const;
export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

// ** Workspace types
export const WORKSPACE_STATUSES = [
  "idle",
  "starting",
  "running",
  "stopping",
  "stopped",
  "error",
] as const;
export type WorkspaceStatus = (typeof WORKSPACE_STATUSES)[number];

// ** Execution types
export const EXECUTION_STATUSES = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type ExecutionStatus = (typeof EXECUTION_STATUSES)[number];

// ** Artifact types
export const ARTIFACT_TYPES = [
  "file",
  "diff",
  "log",
  "screenshot",
  "other",
] as const;
export type ArtifactType = (typeof ARTIFACT_TYPES)[number];

// ** SSE event types
export interface SSEEvent<T = unknown> {
  type: SSEEventType;
  data: T;
  timestamp: string;
}

export const SSE_EVENT_TYPES = [
  "execution:started",
  "execution:progress",
  "execution:completed",
  "execution:failed",
  "execution:cancelled",
  "log:info",
  "log:warn",
  "log:error",
  "log:debug",
  "artifact:created",
  "tool:called",
  "tool:result",
  "agent:thinking",
  "agent:response",
] as const;
export type SSEEventType = (typeof SSE_EVENT_TYPES)[number];

// ** Execution log entry
export interface ExecutionLogEntry {
  level: "info" | "warn" | "error" | "debug";
  message: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

// ** Tool call event
export interface ToolCallEvent {
  toolName: string;
  input: Record<string, unknown>;
  output?: unknown;
  durationMs?: number;
}
