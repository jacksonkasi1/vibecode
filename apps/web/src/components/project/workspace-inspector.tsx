// ** import types
import type { Artifact, Execution } from "@repo/db";
import type { ReactNode } from "react";
import type { ExecutionData } from "./use-execution-data";
import type { WorkspaceMode, WorkspaceSource } from "./workspace-types";

// ** import core packages
import { FileCode2, GitBranch, GitCommitHorizontal, Info } from "lucide-react";

// ** import components
import { ExecutionRightView } from "./execution-workspace";

// ** import utils
import { detectLanguageFromPath, formatDateTime } from "./execution-utils";
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
  selectedFile,
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

        {workspaceMode === "code" ? (
          <InspectorSection
            label="Selected File"
            icon={<FileCode2 className="size-3.5" />}
          >
            {selectedFile ? (
              <div className="space-y-2 text-xs text-muted-foreground/80">
                <div className="break-words text-foreground/90">
                  {selectedFile.filePath || selectedFile.name}
                </div>
                <div>
                  <span className="text-muted-foreground/60">Type:</span>{" "}
                  {selectedFile.type}
                </div>
                <div>
                  <span className="text-muted-foreground/60">Language:</span>{" "}
                  {detectLanguageFromPath(
                    selectedFile.filePath || selectedFile.name,
                  )}
                </div>
              </div>
            ) : (
              <div className="text-xs text-muted-foreground/75">
                Select a file to inspect.
              </div>
            )}
          </InspectorSection>
        ) : null}

        {workspaceMode === "app" ? (
          <InspectorSection label="App Mode">
            <div className="text-xs leading-5 text-muted-foreground/75">
              App shows artifact preview states. Use Review for changed files,
              Timeline for agent flow, and Details for the final run report.
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

        {workspaceMode === "review" && executionData.changes.length > 0 ? (
          <InspectorSection label="Quick Summary">
            <div className="text-xs text-muted-foreground/75">
              {executionData.changes.length} changed file
              {executionData.changes.length === 1 ? "" : "s"} in this run.
            </div>
          </InspectorSection>
        ) : null}
      </div>
    </aside>
  );
}
