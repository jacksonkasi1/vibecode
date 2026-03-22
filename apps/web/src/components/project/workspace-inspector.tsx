// ** import types
import type { Artifact, Execution } from "@repo/db";
import type { ReactNode } from "react";
import type { ExecutionData } from "./use-execution-data";
import type { WorkspaceMode, WorkspaceSource } from "./workspace-types";

// ** import core packages
import { GitBranch, GitCommitHorizontal, Info } from "lucide-react";

// ** import components
import { ExecutionRightView } from "./execution-workspace";

// ** import utils
import { formatDateTime } from "./execution-utils";
import {
  WORKSPACE_SOURCE_DESCRIPTIONS,
  WORKSPACE_SOURCE_LABELS,
  getWorkspaceStatusLabel,
} from "./workspace-types";

function InspectorSection({
  label,
  children,
  icon,
}: {
  label: string;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <section className="border-b border-border/25 px-4 py-3 last:border-b-0">
      <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
        {icon}
        <span>{label}</span>
      </div>
      <div className="mt-2 text-sm text-foreground/88">{children}</div>
    </section>
  );
}

export function WorkspaceInspector({
  workspaceMode,
  workspaceSource,
  execution,
  selectedFile: _selectedFile,
  executionData,
  onOpenFile,
}: {
  workspaceMode: WorkspaceMode;
  workspaceSource: WorkspaceSource;
  execution: Execution | null;
  selectedFile: Artifact | null;
  executionData: ExecutionData;
  onOpenFile: (path: string) => void;
}) {
  if (workspaceMode === "review") {
    const { changes, selectedChange, setSelectedChangePath } = executionData;

    return (
      <aside className="z-10 flex w-[18rem] shrink-0 flex-col border-l border-border/30 bg-card/15">
        <div className="border-b border-border/25 px-4 py-3">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
            Changes
          </p>
          <p className="mt-1 text-sm font-medium text-foreground">
            {changes.length} changed file{changes.length === 1 ? "" : "s"}
          </p>
        </div>

        <div className="flex-1 overflow-y-auto p-2">
          {changes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/40 bg-background/70 px-3 py-6 text-center text-xs text-muted-foreground">
              No file changes available yet.
            </div>
          ) : (
            <div className="space-y-0.5">
              {changes.map((change) => (
                <button
                  key={change.path}
                  type="button"
                  onClick={() => {
                    setSelectedChangePath(change.path);
                    onOpenFile(change.path);
                  }}
                  className={[
                    "flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors",
                    selectedChange?.path === change.path
                      ? "bg-primary/10 text-foreground"
                      : "text-muted-foreground hover:bg-muted/40 hover:text-foreground",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "inline-flex h-5 min-w-5 items-center justify-center rounded-md border text-[10px] font-semibold uppercase",
                      change.status === "added"
                        ? "border-vibe-success/25 bg-vibe-success/10 text-vibe-success"
                        : change.status === "deleted"
                          ? "border-destructive/25 bg-destructive/10 text-destructive"
                          : "border-vibe-warning/25 bg-vibe-warning/10 text-vibe-warning",
                    ].join(" ")}
                  >
                    {change.status === "added"
                      ? "A"
                      : change.status === "deleted"
                        ? "D"
                        : "M"}
                  </span>
                  <span className="truncate text-xs font-medium">
                    {change.path}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </aside>
    );
  }

  return (
    <aside className="z-10 flex w-[19rem] shrink-0 flex-col border-l border-border/30 bg-card/15">
      <div className="border-b border-border/25 px-4 py-3">
        <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
          Inspector
        </p>
        <p className="mt-1 line-clamp-2 text-sm text-foreground/92">
          {execution?.taskDescription ||
            execution?.prompt ||
            "Workspace context"}
        </p>
      </div>

      <div className="flex-1 overflow-y-auto">
        <InspectorSection
          label="Source"
          icon={<GitBranch className="size-3.5" />}
        >
          <div>{WORKSPACE_SOURCE_LABELS[workspaceSource]}</div>
          <div className="mt-1 text-xs leading-5 text-muted-foreground/75">
            {WORKSPACE_SOURCE_DESCRIPTIONS[workspaceSource]}
          </div>
        </InspectorSection>

        <InspectorSection label="Status" icon={<Info className="size-3.5" />}>
          <div>{getWorkspaceStatusLabel(execution)}</div>
          <div className="mt-1 text-xs text-muted-foreground/75">
            {execution?.createdAt
              ? `Started ${formatDateTime(execution.createdAt)}`
              : "No execution selected"}
          </div>
        </InspectorSection>

        {execution?.worktreeBranch || execution?.mergedCommitHash ? (
          <InspectorSection
            label="Merge State"
            icon={<GitCommitHorizontal className="size-3.5" />}
          >
            <div className="space-y-1.5 text-xs text-muted-foreground/80">
              {execution.worktreeBranch ? (
                <div className="flex items-center gap-2">
                  <GitBranch className="size-3.5 text-primary" />
                  <span className="truncate">{execution.worktreeBranch}</span>
                </div>
              ) : null}
              {execution.mergedCommitHash ? (
                <div className="flex items-center gap-2">
                  <GitCommitHorizontal className="size-3.5 text-primary" />
                  <span className="truncate">{execution.mergedCommitHash}</span>
                </div>
              ) : null}
            </div>
          </InspectorSection>
        ) : null}

        {workspaceMode !== "app" && workspaceMode !== "code" ? (
          <div className="min-h-0">
            <ExecutionRightView
              workspaceMode={workspaceMode}
              data={executionData}
              onOpenFile={onOpenFile}
            />
          </div>
        ) : null}
      </div>
    </aside>
  );
}
