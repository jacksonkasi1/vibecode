// ** import types
import type { AgentTask, Artifact, Execution, ExecutionEvent } from "@repo/db";

// ** import core packages
import { DiffEditor } from "@monaco-editor/react";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  FileCode2,
  GitBranch,
  GitCommitHorizontal,
  Loader2,
  Sparkles,
  TerminalSquare,
  TriangleAlert,
  Wrench,
} from "lucide-react";

// ** import apis
import { getAgentTasks, getExecutionEvents } from "@/rest-api/executions";

type InspectorTab = "details" | "timeline" | "changes";

type TimelineKind = "run" | "thinking" | "tool" | "task" | "status";
type TimelineStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "conflicted"
  | "cancelled"
  | "pending";

type TimelineItem = {
  id: string;
  kind: TimelineKind;
  title: string;
  summary?: string;
  status: TimelineStatus;
  seq: number;
  startedAt?: string;
  endedAt?: string;
  payload?: Record<string, unknown>;
  result?: string;
  error?: string;
  childLines?: string[];
  relatedPath?: string;
};

type FileChange = {
  path: string;
  status: "added" | "modified" | "deleted";
  before: string;
  after: string;
};

function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

function readArtifactContent(artifact: Artifact | null | undefined) {
  const parsed = safeJsonParse<{ content?: unknown }>(artifact?.metadata);
  return typeof parsed?.content === "string" ? parsed.content : "";
}

function readExecutionText(execution: Execution | null | undefined) {
  const parsed = safeJsonParse<{ text?: unknown }>(execution?.result);
  return typeof parsed?.text === "string" ? parsed.text : "";
}

function formatDateTime(value: Date | string | null | undefined) {
  if (!value) return "-";
  return new Date(String(value)).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDuration(
  start: Date | string | null | undefined,
  end?: Date | string | null,
) {
  if (!start) return "-";
  const startTime = new Date(String(start)).getTime();
  const endTime = end ? new Date(String(end)).getTime() : Date.now();
  const seconds = Math.max(0, Math.round((endTime - startTime) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m ${seconds % 60}s`;
}

function summarizeArgs(args: Record<string, unknown>) {
  const candidates = [
    args.description,
    args.command,
    args.filePath,
    args.path,
    args.pattern,
    args.url,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return "";
}

function extractRelatedPath(args: Record<string, unknown>) {
  const candidates = [args.filePath, args.path];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim())
      return candidate.trim();
  }
  return undefined;
}

function deriveTimelineItems(events: ExecutionEvent[], tasks: AgentTask[]) {
  const items: TimelineItem[] = [];
  const tools = new Map<string, TimelineItem>();
  const taskItems = new Map<string, TimelineItem>();

  for (const event of events) {
    const payload =
      event.payloadJson && typeof event.payloadJson === "object"
        ? (event.payloadJson as Record<string, unknown>)
        : {};

    if (event.type === "editor:context") continue;

    if (event.type === "run:start") {
      items.push({
        id: `run-${event.seq}`,
        kind: "run",
        title: "Execution started",
        summary: `Using ${String(payload.runtime || "agent runtime")}`,
        status: "running",
        seq: event.seq,
        startedAt: String(event.createdAt),
        payload,
      });
      continue;
    }

    if (event.type === "agent:thinking") {
      items.push({
        id: `thinking-${event.seq}`,
        kind: "thinking",
        title: String(payload.label || "Reasoning"),
        status: "completed",
        seq: event.seq,
        startedAt: String(event.createdAt),
        payload,
      });
      continue;
    }

    if (event.type === "tool:call") {
      const args =
        payload.args && typeof payload.args === "object"
          ? (payload.args as Record<string, unknown>)
          : {};
      const id = String(payload.id || `tool-${event.seq}`);
      const name = String(payload.name || "tool");
      const summary = summarizeArgs(args);
      const item: TimelineItem = {
        id,
        kind: "tool",
        title: name,
        summary: summary || "Tool call",
        status: "running",
        seq: event.seq,
        startedAt: String(event.createdAt),
        payload: args,
        relatedPath: extractRelatedPath(args),
      };
      items.push(item);
      tools.set(id, item);
      continue;
    }

    if (event.type === "tool:result" || event.type === "tool:error") {
      const id = String(payload.id || "");
      const item = tools.get(id);
      const resultText =
        typeof payload.result === "string"
          ? payload.result
          : typeof payload.error === "string"
            ? payload.error
            : "";

      if (item) {
        item.status = event.type === "tool:error" ? "failed" : "completed";
        item.endedAt = String(event.createdAt);
        item.result = event.type === "tool:error" ? undefined : resultText;
        item.error = event.type === "tool:error" ? resultText : undefined;
      }
      continue;
    }

    if (event.type === "task:start") {
      const taskId = String(payload.taskId || `task-${event.seq}`);
      const item: TimelineItem = {
        id: taskId,
        kind: "task",
        title: String(payload.agentName || "Sub-agent"),
        summary: String(payload.description || "Delegated work"),
        status: "running",
        seq: event.seq,
        startedAt: String(event.createdAt),
        payload,
        childLines: [],
      };
      items.push(item);
      taskItems.set(taskId, item);
      continue;
    }

    if (
      event.type === "task:update" ||
      event.type === "task:complete" ||
      event.type === "task:error"
    ) {
      const taskId = String(payload.taskId || "");
      const item = taskItems.get(taskId);
      if (item) {
        if (
          event.type === "task:update" &&
          typeof payload.content === "string"
        ) {
          item.childLines = [...(item.childLines || []), payload.content].slice(
            -6,
          );
        }
        if (event.type === "task:complete") {
          item.status = "completed";
          item.endedAt = String(event.createdAt);
          item.result =
            typeof payload.result === "string" ? payload.result : undefined;
        }
        if (event.type === "task:error") {
          item.status = "failed";
          item.endedAt = String(event.createdAt);
          item.error =
            typeof payload.errorMessage === "string"
              ? payload.errorMessage
              : "Sub-agent failed";
        }
      }
      continue;
    }

    if (event.type === "status") {
      const status = String(payload.status || "completed") as TimelineStatus;
      items.push({
        id: `status-${event.seq}`,
        kind: "status",
        title:
          status === "conflicted"
            ? "Execution completed with conflict"
            : status === "failed"
              ? "Execution failed"
              : "Execution completed",
        summary:
          typeof payload.errorMessage === "string"
            ? payload.errorMessage
            : undefined,
        status,
        seq: event.seq,
        startedAt: String(event.createdAt),
        payload,
      });
    }
  }

  for (const task of tasks) {
    const existing = taskItems.get(task.id);
    if (!existing) {
      items.push({
        id: task.id,
        kind: "task",
        title: task.agentName,
        summary: task.description,
        status: task.status === "pending" ? "pending" : task.status,
        seq: Number.MAX_SAFE_INTEGER,
        startedAt: String(task.createdAt),
        endedAt: task.completedAt ? String(task.completedAt) : undefined,
        result: task.result || undefined,
        error: task.errorMessage || undefined,
      });
    }
  }

  return items.sort((left, right) => left.seq - right.seq);
}

function deriveFileChanges(
  currentArtifacts: Artifact[],
  previousArtifacts: Artifact[],
) {
  const currentMap = new Map(
    currentArtifacts.map((artifact) => [
      artifact.filePath || artifact.name,
      artifact,
    ]),
  );
  const previousMap = new Map(
    previousArtifacts.map((artifact) => [
      artifact.filePath || artifact.name,
      artifact,
    ]),
  );
  const paths = new Set([...currentMap.keys(), ...previousMap.keys()]);

  const changes: FileChange[] = [];

  for (const path of [...paths].sort()) {
    const current = currentMap.get(path);
    const previous = previousMap.get(path);
    const after = readArtifactContent(current);
    const before = readArtifactContent(previous);

    if (!previous && current) {
      changes.push({ path, status: "added", before: "", after });
      continue;
    }

    if (previous && !current) {
      changes.push({ path, status: "deleted", before, after: "" });
      continue;
    }

    if (previous && current && before !== after) {
      changes.push({ path, status: "modified", before, after });
    }
  }

  return changes;
}

function detectLanguageFromPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".tsx") || lower.endsWith(".ts")) return "typescript";
  if (lower.endsWith(".jsx") || lower.endsWith(".js")) return "javascript";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".html")) return "html";
  return "plaintext";
}

function StatusIcon({ status }: { status: TimelineStatus }) {
  if (status === "queued" || status === "running") {
    return <Loader2 className="size-3.5 animate-spin text-vibe-warning" />;
  }
  if (status === "failed") {
    return <TriangleAlert className="size-3.5 text-destructive" />;
  }
  if (status === "conflicted") {
    return <GitBranch className="size-3.5 text-vibe-warning" />;
  }
  if (status === "pending") {
    return <Clock3 className="size-3.5 text-muted-foreground/70" />;
  }
  if (status === "cancelled") {
    return <Clock3 className="size-3.5 text-muted-foreground/80" />;
  }
  return <CheckCircle2 className="size-3.5 text-vibe-success" />;
}

function KindIcon({ kind }: { kind: TimelineKind }) {
  if (kind === "thinking") return <Sparkles className="size-3.5" />;
  if (kind === "tool") return <Wrench className="size-3.5" />;
  if (kind === "task") return <Bot className="size-3.5" />;
  if (kind === "status") return <TerminalSquare className="size-3.5" />;
  return <Clock3 className="size-3.5" />;
}

export function ExecutionInspector({
  execution,
  previousExecution,
  artifacts,
  previousArtifacts,
  activeTab,
  onOpenFile,
  editorTheme,
}: {
  execution: Execution | null;
  previousExecution: Execution | null;
  artifacts: Artifact[];
  previousArtifacts: Artifact[];
  activeTab: InspectorTab;
  onOpenFile?: (path: string) => void;
  editorTheme: "vs" | "vs-dark";
}) {
  const isRunning =
    execution?.status === "running" || execution?.status === "queued";
  const { data: eventsRes } = useQuery({
    queryKey: ["execution-events", execution?.id],
    queryFn: () => getExecutionEvents(execution!.id),
    enabled: !!execution?.id,
    refetchInterval: isRunning ? 2000 : false,
    staleTime: isRunning ? 1000 : Number.POSITIVE_INFINITY,
  });
  const { data: tasksRes } = useQuery({
    queryKey: ["agent-tasks", execution?.id],
    queryFn: () => getAgentTasks(execution!.id),
    enabled: !!execution?.id,
    refetchInterval: isRunning ? 3000 : false,
    staleTime: isRunning ? 1000 : Number.POSITIVE_INFINITY,
  });

  const events = eventsRes?.data ?? [];
  const tasks = tasksRes?.data ?? [];
  const timelineItems = useMemo(
    () => deriveTimelineItems(events, tasks),
    [events, tasks],
  );
  const changes = useMemo(
    () =>
      artifacts.length > 0
        ? deriveFileChanges(artifacts, previousArtifacts)
        : [],
    [artifacts, previousArtifacts],
  );
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [selectedChangePath, setSelectedChangePath] = useState<string | null>(
    null,
  );

  const selectedChange =
    changes.find((change) => change.path === selectedChangePath) ||
    changes[0] ||
    null;

  if (!execution) {
    return (
      <aside className="hidden w-[420px] shrink-0 border-l border-border/40 bg-card/25 lg:flex lg:flex-col">
        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
          Select a thread to inspect execution details.
        </div>
      </aside>
    );
  }

  return (
    <aside className="hidden w-[420px] shrink-0 border-l border-border/40 bg-card/25 lg:flex lg:flex-col">
      <div className="flex h-11 items-center justify-between border-b border-border/40 px-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium text-muted-foreground/70">
            Inspector
          </p>
          <p className="truncate text-sm font-semibold text-foreground/90">
            {execution.taskDescription || execution.prompt}
          </p>
        </div>
        <div className="flex items-center gap-2 rounded-full border border-border/40 bg-background/70 px-2.5 py-1 text-[11px] text-muted-foreground">
          <StatusIcon status={execution.status} />
          <span className="capitalize">{execution.status}</span>
        </div>
      </div>

      {activeTab === "details" ? (
        <div className="flex-1 space-y-4 overflow-y-auto p-4 text-sm">
          <div className="rounded-xl border border-border/40 bg-background/80 p-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                  Status
                </p>
                <div className="mt-2 flex items-center gap-2 text-sm font-medium text-foreground">
                  <StatusIcon status={execution.status} />
                  <span className="capitalize">{execution.status}</span>
                </div>
              </div>
              {execution.modelId ? (
                <span className="rounded-full border border-border/40 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground">
                  {execution.modelId}
                </span>
              ) : null}
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-3 text-xs text-muted-foreground">
              <div className="rounded-lg border border-border/30 bg-muted/20 p-3">
                <dt>Started</dt>
                <dd className="mt-1 text-foreground/90">
                  {formatDateTime(execution.createdAt)}
                </dd>
              </div>
              <div className="rounded-lg border border-border/30 bg-muted/20 p-3">
                <dt>Duration</dt>
                <dd className="mt-1 text-foreground/90">
                  {formatDuration(execution.createdAt, execution.completedAt)}
                </dd>
              </div>
              <div className="rounded-lg border border-border/30 bg-muted/20 p-3">
                <dt>Runtime</dt>
                <dd className="mt-1 text-foreground/90">{execution.runtime}</dd>
              </div>
              <div className="rounded-lg border border-border/30 bg-muted/20 p-3">
                <dt>Classification</dt>
                <dd className="mt-1 text-foreground/90">
                  {execution.classification || "single"}
                </dd>
              </div>
            </dl>
          </div>

          {execution.errorMessage ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
              <p className="font-semibold">Execution note</p>
              <p className="mt-2 whitespace-pre-wrap text-destructive/90">
                {execution.errorMessage}
              </p>
            </div>
          ) : null}

          <div className="rounded-xl border border-border/40 bg-background/80 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
              Final response
            </p>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-6 text-foreground/85">
              {readExecutionText(execution) || "No final response yet."}
            </div>
          </div>

          <div className="rounded-xl border border-border/40 bg-background/80 p-4 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <GitBranch className="size-3.5" />
              <span className="truncate">
                {execution.worktreeBranch || "No preserved branch"}
              </span>
            </div>
            {execution.mergedCommitHash ? (
              <div className="mt-3 flex items-center gap-2">
                <GitCommitHorizontal className="size-3.5" />
                <span className="truncate">{execution.mergedCommitHash}</span>
              </div>
            ) : null}
            {previousExecution ? (
              <div className="mt-3 border-t border-border/30 pt-3">
                Compared against previous execution from{" "}
                {formatDateTime(previousExecution.createdAt)}.
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {activeTab === "timeline" ? (
        <div className="flex-1 overflow-y-auto p-4">
          <div className="space-y-3">
            {timelineItems.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border/40 bg-background/70 px-4 py-8 text-center text-sm text-muted-foreground">
                Timeline will appear as execution events arrive.
              </div>
            ) : null}

            {timelineItems.map((item) => {
              const isExpanded = expandedIds.has(item.id);
              return (
                <div
                  key={`${item.id}-${item.seq}`}
                  className="rounded-xl border border-border/40 bg-background/85"
                >
                  <button
                    type="button"
                    onClick={() => {
                      setExpandedIds((current) => {
                        const next = new Set(current);
                        if (next.has(item.id)) next.delete(item.id);
                        else next.add(item.id);
                        return next;
                      });
                      if (item.relatedPath) onOpenFile?.(item.relatedPath);
                    }}
                    className="flex w-full items-start gap-3 px-3 py-3 text-left"
                  >
                    <div className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-border/40 bg-muted/25 text-muted-foreground">
                      <KindIcon kind={item.kind} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-semibold text-foreground/90">
                          {item.title}
                        </p>
                        <StatusIcon status={item.status} />
                      </div>
                      {item.summary ? (
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                          {item.summary}
                        </p>
                      ) : null}
                      <div className="mt-2 flex items-center gap-2 text-[11px] text-muted-foreground/70">
                        <span>{formatDateTime(item.startedAt)}</span>
                        {item.endedAt ? (
                          <span>
                            • {formatDuration(item.startedAt, item.endedAt)}
                          </span>
                        ) : null}
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronDown className="mt-1 size-4 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="mt-1 size-4 text-muted-foreground" />
                    )}
                  </button>

                  {isExpanded ? (
                    <div className="border-t border-border/30 px-3 py-3 text-xs">
                      {item.payload ? (
                        <pre className="max-h-56 overflow-auto rounded-lg border border-border/30 bg-muted/20 p-3 whitespace-pre-wrap break-words text-muted-foreground">
                          {JSON.stringify(item.payload, null, 2)}
                        </pre>
                      ) : null}
                      {item.childLines?.length ? (
                        <div className="mt-3 space-y-1.5 rounded-lg border border-border/30 bg-muted/20 p-3 text-muted-foreground">
                          {item.childLines.map((line, index) => (
                            <p key={`${item.id}-line-${index}`}>{line}</p>
                          ))}
                        </div>
                      ) : null}
                      {item.result ? (
                        <pre className="mt-3 max-h-56 overflow-auto rounded-lg border border-border/30 bg-muted/20 p-3 whitespace-pre-wrap break-words text-foreground/80">
                          {item.result}
                        </pre>
                      ) : null}
                      {item.error ? (
                        <div className="mt-3 rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-destructive">
                          {item.error}
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : null}

      {activeTab === "changes" ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="border-b border-border/40 px-3 py-2 text-xs text-muted-foreground">
            {isRunning
              ? "Changes snapshot updates after the execution settles."
              : `${changes.length} changed file${changes.length === 1 ? "" : "s"}`}
          </div>
          <div className="flex min-h-0 flex-1">
            <div className="w-44 shrink-0 border-r border-border/40 overflow-y-auto p-2">
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
                      "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                      selectedChange?.path === change.path
                        ? "border-primary/40 bg-primary/10"
                        : "border-transparent bg-background/70 hover:border-border/40 hover:bg-muted/20",
                    ].join(" ")}
                  >
                    <div className="flex items-center gap-2">
                      <FileCode2 className="size-3.5 text-muted-foreground" />
                      <span className="truncate text-xs font-medium text-foreground/90">
                        {change.path.split("/").pop()}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-[10px] text-muted-foreground/70">
                      {change.path}
                    </div>
                    <div className="mt-1 text-[11px] capitalize text-muted-foreground">
                      {change.status}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            <div className="min-w-0 flex-1 bg-background/70">
              {selectedChange ? (
                <div className="flex h-full flex-col">
                  <div className="border-b border-border/40 px-3 py-2">
                    <p className="truncate text-sm font-semibold text-foreground/90">
                      {selectedChange.path}
                    </p>
                    <p className="text-xs capitalize text-muted-foreground">
                      {selectedChange.status}
                    </p>
                  </div>
                  <div className="min-h-0 flex-1">
                    <DiffEditor
                      theme={editorTheme}
                      original={selectedChange.before}
                      modified={selectedChange.after}
                      language={detectLanguageFromPath(selectedChange.path)}
                      options={{
                        readOnly: true,
                        minimap: { enabled: false },
                        renderSideBySide: false,
                        scrollBeyondLastLine: false,
                        lineNumbersMinChars: 3,
                        fontSize: 12,
                      }}
                    />
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
                  Select a changed file to inspect the diff.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </aside>
  );
}
