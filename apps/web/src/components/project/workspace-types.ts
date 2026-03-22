// ** import types
import type { Execution } from "@repo/db";

export type WorkspaceMode = "app" | "code" | "review" | "timeline" | "details";

export type WorkspaceSource = "execution_draft" | "main" | "conflicted_draft";

export const WORKSPACE_MODE_OPTIONS: Array<{
  value: WorkspaceMode;
  label: string;
}> = [
  { value: "app", label: "App" },
  { value: "code", label: "Code" },
  { value: "review", label: "Review" },
  { value: "timeline", label: "Timeline" },
  { value: "details", label: "Details" },
];

export const WORKSPACE_SOURCE_LABELS: Record<WorkspaceSource, string> = {
  execution_draft: "This Response",
  main: "Current Project",
  conflicted_draft: "Unsaved Changes",
};

export const WORKSPACE_SOURCE_DESCRIPTIONS: Record<WorkspaceSource, string> = {
  execution_draft: "Files written by the agent for this response",
  main: "The current saved state of your project",
  conflicted_draft: "Agent changes that couldn't be merged automatically",
};

export function getDefaultWorkspaceSource(
  execution: Execution | null | undefined,
): WorkspaceSource {
  if (execution?.status === "conflicted") {
    return "conflicted_draft";
  }

  if (execution?.mergedCommitHash) {
    return "main";
  }

  return "execution_draft";
}

export function getAvailableWorkspaceSources(
  execution: Execution | null | undefined,
): WorkspaceSource[] {
  const sources: WorkspaceSource[] = [];

  if (execution) {
    sources.push("execution_draft");
  }

  if (execution?.mergedCommitHash) {
    sources.push("main");
  }

  if (execution?.status === "conflicted") {
    sources.push("conflicted_draft");
  }

  if (sources.length === 0) {
    sources.push("main");
  }

  return sources;
}

export function getWorkspaceStatusLabel(
  execution: Execution | null | undefined,
): string {
  if (!execution) {
    return "Idle";
  }

  if (execution.status === "conflicted") {
    return "Merge conflict";
  }

  if (execution.status === "completed" && execution.mergedCommitHash) {
    return "Merged";
  }

  return execution.status.charAt(0).toUpperCase() + execution.status.slice(1);
}

export function getWorkspacePrimaryAction(
  source: WorkspaceSource,
  execution: Execution | null | undefined,
): string {
  if (source === "main") {
    return "Open App";
  }

  if (source === "conflicted_draft") {
    return "Compare to Main";
  }

  if (execution?.mergedCommitHash) {
    return "View Main";
  }

  return "Review Changes";
}
