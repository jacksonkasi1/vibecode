// ** import types
import type { ExecutionData } from "./use-execution-data";
import type { WorkspaceMode } from "./workspace-types";

// ** import core packages
import { DiffEditor } from "@monaco-editor/react";
import {
  FileCode2,
  GitBranch,
  GitCommitHorizontal,
  TriangleAlert,
} from "lucide-react";

// ** import components
import { StatusIcon, KindIcon } from "./execution-icons";

// ** import utils
import {
  formatDateTime,
  formatDuration,
  readExecutionText,
  detectLanguageFromPath,
} from "./execution-utils";

export function ExecutionCenterView({
  workspaceMode,
  data,
  editorTheme,
  onOpenFile,
}: {
  workspaceMode: WorkspaceMode;
  data: ExecutionData;
  editorTheme: "vs" | "vs-dark";
  onOpenFile?: (path: string) => void;
}) {
  const {
    execution,
    timelineItems,
    selectedTimelineId,
    setSelectedTimelineId,
    selectedChange,
  } = data;

  if (!execution) return null;

  if (workspaceMode === "details") {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 overflow-y-auto p-6">
        <div className="rounded-xl border border-border/30 bg-card/35 p-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                Execution Details
              </p>
              <h2 className="mt-2 text-xl font-bold text-foreground">
                {execution.taskDescription || execution.prompt}
              </h2>
              <div className="mt-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <StatusIcon status={execution.status} />
                <span className="capitalize">{execution.status}</span>
              </div>
            </div>
            {execution.modelId ? (
              <span className="rounded-full border border-border/30 bg-muted/20 px-3 py-1 text-xs font-medium text-muted-foreground">
                {execution.modelId}
              </span>
            ) : null}
          </div>

          <dl className="mt-5 grid grid-cols-2 gap-3 text-sm text-muted-foreground md:grid-cols-4">
            <div className="rounded-lg border border-border/25 bg-muted/15 p-3">
              <dt>Started</dt>
              <dd className="mt-1 text-foreground/90 font-medium">
                {formatDateTime(execution.createdAt)}
              </dd>
            </div>
            <div className="rounded-lg border border-border/25 bg-muted/15 p-3">
              <dt>Duration</dt>
              <dd className="mt-1 text-foreground/90 font-medium">
                {formatDuration(execution.createdAt, execution.completedAt)}
              </dd>
            </div>
            <div className="rounded-lg border border-border/25 bg-muted/15 p-3">
              <dt>Runtime</dt>
              <dd className="mt-1 text-foreground/90 font-medium">
                {execution.runtime}
              </dd>
            </div>
            <div className="rounded-lg border border-border/25 bg-muted/15 p-3">
              <dt>Classification</dt>
              <dd className="mt-1 text-foreground/90 font-medium">
                {execution.classification || "single"}
              </dd>
            </div>
          </dl>
        </div>

        {execution.errorMessage ? (
          <div className="rounded-xl border border-destructive/25 bg-destructive/5 p-5 text-sm text-destructive">
            <p className="font-semibold text-base flex items-center gap-2">
              <TriangleAlert className="size-4" /> Execution Failed
            </p>
            <p className="mt-3 whitespace-pre-wrap rounded-md bg-destructive/10 p-3 font-mono text-xs text-destructive/90">
              {execution.errorMessage}
            </p>
          </div>
        ) : null}

        <div className="rounded-xl border border-border/30 bg-card/35 p-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            Final response
          </p>
          <div className="mt-4 whitespace-pre-wrap text-sm leading-7 text-foreground/85">
            {readExecutionText(execution) || "No final response yet."}
          </div>
        </div>
      </div>
    );
  }

  if (workspaceMode === "timeline") {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-1 overflow-y-auto p-4">
        <div className="w-full space-y-1">
          {timelineItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/40 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
              Timeline will appear as execution events arrive.
            </div>
          ) : null}

          {timelineItems.map((item) => {
            const isSelected = selectedTimelineId === item.id;
            return (
              <button
                key={`${item.id}-${item.seq}`}
                type="button"
                onClick={() => {
                  setSelectedTimelineId(item.id);
                  if (item.relatedPath) onOpenFile?.(item.relatedPath);
                }}
                className={[
                  "w-full rounded-md border px-3 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
                  isSelected
                    ? "border-primary/30 bg-primary/10 shadow-sm"
                    : "border-transparent bg-transparent hover:bg-muted/50",
                ].join(" ")}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded bg-muted/50 text-foreground/80">
                    <KindIcon kind={item.kind} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <p className="truncate text-sm font-medium text-foreground">
                        {item.title}
                      </p>
                      <StatusIcon status={item.status} />
                    </div>
                    {item.relatedPath ? (
                      <p className="mt-0.5 truncate text-[11px] text-muted-foreground/80">
                        {item.relatedPath}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0 text-right">
                    <div className="text-[10px] uppercase tracking-wider text-muted-foreground/60">
                      {item.duration > 0
                        ? formatDuration(item.duration)
                        : formatDateTime(item.timestamp, true)}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  if (workspaceMode === "review") {
    return (
      <div className="flex min-h-0 flex-1 bg-background">
        {selectedChange ? (
          <div className="flex h-full w-full flex-col">
            <div className="flex items-center gap-3 border-b border-border/30 bg-card/20 px-4 py-2">
              <FileCode2 className="size-4 text-primary" />
              <p className="truncate text-sm font-semibold text-foreground">
                {selectedChange.path}
              </p>
              <span className="ml-auto rounded-full border border-border/30 bg-background/70 px-2 py-0.5 text-[10px] font-medium capitalize text-muted-foreground">
                {selectedChange.status}
              </span>
            </div>
            <div className="min-h-0 flex-1 pt-2">
              <DiffEditor
                key={selectedChange.path}
                theme={editorTheme}
                original={selectedChange.before}
                modified={selectedChange.after}
                language={detectLanguageFromPath(selectedChange.path)}
                beforeMount={(monaco) => {
                  const uri = monaco.Uri.parse(
                    `inmemory://diff/${selectedChange.path}`,
                  );
                  const existing = monaco.editor.getModel(uri);
                  if (existing) existing.dispose();
                }}
                options={{
                  readOnly: true,
                  minimap: { enabled: false },
                  renderSideBySide: true,
                  scrollBeyondLastLine: false,
                  lineNumbersMinChars: 3,
                  fontSize: 13,
                  padding: { top: 16 },
                }}
              />
            </div>
          </div>
        ) : (
          <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Select a changed file to inspect the diff.
          </div>
        )}
      </div>
    );
  }

  return null;
}

export function ExecutionRightView({
  workspaceMode,
  data,
  onOpenFile,
}: {
  workspaceMode: WorkspaceMode;
  data: ExecutionData;
  onOpenFile?: (path: string) => void;
}) {
  const {
    execution,
    previousExecution,
    selectedTimelineItem,
    selectedTimelineDetail,
    changes,
    isRunning,
    selectedChange,
    setSelectedChangePath,
  } = data;

  if (!execution) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
        Select a thread to inspect execution details.
      </div>
    );
  }

  if (workspaceMode === "details") {
    return (
      <div className="space-y-4 p-4 text-sm">
        <div className="rounded-xl border border-border/25 bg-background/40 p-4">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            Source Info
          </p>
          <div className="space-y-3 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <GitBranch className="size-3.5 text-primary" />
              <span className="truncate">
                {execution.worktreeBranch || "No preserved branch"}
              </span>
            </div>
            {execution.mergedCommitHash ? (
              <div className="flex items-center gap-2">
                <GitCommitHorizontal className="size-3.5 text-primary" />
                <span className="truncate">{execution.mergedCommitHash}</span>
              </div>
            ) : null}
          </div>
          {previousExecution ? (
            <div className="mt-4 border-t border-border/30 pt-4 text-[11px] text-muted-foreground/70">
              Compared against previous execution from{" "}
              {formatDateTime(previousExecution.createdAt)}.
            </div>
          ) : null}
        </div>
      </div>
    );
  }

  if (workspaceMode === "timeline") {
    if (!selectedTimelineItem) {
      return (
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Select a timeline event to view details.
        </div>
      );
    }

    return (
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4 text-sm">
        <div className="border-b border-border/25 pb-4">
          <div className="mb-2 flex items-center gap-2">
            <KindIcon kind={selectedTimelineItem.kind} />
            <span className="font-semibold text-foreground capitalize">
              {selectedTimelineItem.kind} Details
            </span>
          </div>
          <p className="text-muted-foreground text-xs">
            {selectedTimelineItem.title}
          </p>
        </div>

        {selectedTimelineDetail?.payload &&
        Object.keys(selectedTimelineDetail.payload).length > 0 ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              Payload
            </p>
            <pre className="max-h-[300px] overflow-auto rounded-lg border border-border/25 bg-muted/15 p-3 font-mono text-xs text-muted-foreground whitespace-pre-wrap break-words">
              {JSON.stringify(selectedTimelineDetail.payload, null, 2)}
            </pre>
          </div>
        ) : null}

        {selectedTimelineDetail?.childLines?.length ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              Logs
            </p>
            <div className="space-y-1.5 rounded-lg border border-border/25 bg-muted/15 p-3 font-mono text-xs text-muted-foreground">
              {selectedTimelineDetail.childLines.map((line, index) => (
                <p key={`${selectedTimelineItem.id}-line-${index}`}>{line}</p>
              ))}
            </div>
          </div>
        ) : null}

        {selectedTimelineDetail?.result ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              Result
            </p>
            <pre className="max-h-[300px] overflow-auto rounded-lg border border-border/25 bg-muted/15 p-3 font-mono text-xs text-foreground/80 whitespace-pre-wrap break-words">
              {selectedTimelineDetail.result}
            </pre>
          </div>
        ) : null}

        {selectedTimelineDetail?.error ? (
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-destructive/70">
              Error
            </p>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive font-mono">
              {selectedTimelineDetail.error}
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  if (workspaceMode === "review") {
    return (
      <div className="flex h-full flex-col">
        <div className="border-b border-border/25 bg-card/20 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            Changes
          </p>
          <p className="text-sm mt-1 text-foreground">
            {isRunning
              ? "Updating..."
              : `${changes.length} changed file${changes.length === 1 ? "" : "s"}`}
          </p>
        </div>
        <div className="flex-1 overflow-y-auto p-2">
          {changes.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/40 bg-background/70 px-3 py-6 text-center text-xs text-muted-foreground">
              No file changes available yet.
            </div>
          ) : null}
          <div className="space-y-1">
            {changes.map((change) => (
              <button
                key={change.path}
                type="button"
                onClick={() => {
                  setSelectedChangePath(change.path);
                  onOpenFile?.(change.path);
                }}
                className={[
                  "w-full rounded-md px-3 py-2.5 text-left transition-colors flex items-center gap-3",
                  selectedChange?.path === change.path
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:bg-secondary/40 hover:text-foreground",
                ].join(" ")}
              >
                <FileCode2 className="size-4 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">
                    {change.path.split("/").pop()}
                  </div>
                  <div className="truncate text-[10px] opacity-70">
                    {change.path}
                  </div>
                </div>
                <div className="text-[10px] capitalize font-semibold opacity-80">
                  {change.status}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return null;
}
