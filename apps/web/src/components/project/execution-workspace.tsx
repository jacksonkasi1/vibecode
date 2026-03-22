// ** import types
import type { ExecutionData } from "./use-execution-data";
import type { WorkspaceMode } from "./workspace-types";

// ** import core packages
import { DiffEditor } from "@monaco-editor/react";
import { useEffect, useRef } from "react";
import {
  ChevronDown,
  FileCode2,
  GitBranch,
  GitCommitHorizontal,
  TriangleAlert,
} from "lucide-react";

// ** import components
import { StatusIcon, KindIcon } from "./execution-icons";

// ** import utils
import {
  safeJsonParse,
  formatDateTime,
  formatDuration,
  readExecutionText,
  detectLanguageFromPath,
} from "./execution-utils";

function getTimelineItemLabel(item: ExecutionData["timelineItems"][number]) {
  const title = item.title.toLowerCase();

  if (item.kind === "thinking") return "Reasoning";
  if (item.kind === "tool") {
    if (title.includes("read") || title.includes("cat")) return "Read file";
    if (title.includes("write") || title.includes("edit")) return "Edited file";
    if (title.includes("todo")) return "Updated todos";
    if (
      title.includes("bash") ||
      title.includes("exec") ||
      title.includes("terminal")
    ) {
      return "Run command";
    }
  }

  return item.title;
}

function getTimelinePreview(item: ExecutionData["timelineItems"][number]) {
  if (item.relatedPath) return item.relatedPath;
  if (item.summary) return item.summary;
  if (item.kind === "tool") return "Tool call";
  if (item.kind === "thinking") return "AI reasoning";
  return item.status;
}

function getTimelineIconTone(item: ExecutionData["timelineItems"][number]) {
  if (item.status === "failed") {
    return "border-destructive/20 bg-destructive/8 text-destructive";
  }
  if (item.kind === "thinking") {
    return "border-vibe-warning/20 bg-vibe-warning/10 text-vibe-warning";
  }
  if (item.kind === "status") {
    return "border-vibe-success/20 bg-vibe-success/10 text-vibe-success";
  }
  if (item.kind === "tool" && item.relatedPath) {
    return "border-vibe-success/20 bg-vibe-success/10 text-vibe-success";
  }
  return "border-border/40 bg-muted/40 text-foreground/80";
}

function getTimelineStatusText(item: ExecutionData["timelineItems"][number]) {
  if (item.startedAt && item.endedAt) {
    return formatDuration(item.startedAt, item.endedAt);
  }
  if (item.startedAt) {
    return formatDateTime(item.startedAt, true);
  }
  return item.status;
}

function getPayloadFactEntries(payload: Record<string, unknown> | undefined) {
  if (!payload) return [] as Array<[string, string]>;

  const keys = [
    "description",
    "subagent_type",
    "command",
    "filePath",
    "path",
    "pattern",
    "url",
    "runtime",
    "status",
  ];

  return keys
    .map((key) => {
      const value = payload[key];
      if (typeof value !== "string" || !value.trim()) return null;
      return [key.split("_").join(" "), value.trim()] as [string, string];
    })
    .filter((entry): entry is [string, string] => Boolean(entry));
}

function getPrimaryResultText(result: string | null | undefined) {
  if (!result) return null;

  const parsed = safeJsonParse<Record<string, unknown>>(result);
  const candidates = [
    parsed?.text,
    parsed?.result,
    parsed?.content,
    parsed?.summary,
    parsed?.message,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }

  return result.trim();
}

function getTodoItems(payload: Record<string, unknown> | undefined) {
  const todos = payload?.todos;
  if (!Array.isArray(todos))
    return [] as Array<{ content: string; status: string }>;

  return todos
    .map((todo) => {
      if (!todo || typeof todo !== "object") return null;
      const content = "content" in todo ? todo.content : undefined;
      const status = "status" in todo ? todo.status : undefined;

      if (typeof content !== "string" || typeof status !== "string")
        return null;
      return { content, status };
    })
    .filter((todo): todo is { content: string; status: string } =>
      Boolean(todo),
    );
}

function getReviewSectionId(path: string) {
  return `review-${encodeURIComponent(path)}`;
}

function getReviewDiffHeight(change: ExecutionData["changes"][number]) {
  const lineCount = Math.max(
    change.before.split("\n").length,
    change.after.split("\n").length,
  );

  return Math.min(Math.max(lineCount * 20, 260), 720);
}

function TimelineJsonBlock({
  label,
  value,
}: {
  label: string;
  value: Record<string, unknown> | string;
}) {
  const content =
    typeof value === "string" ? value : JSON.stringify(value, null, 2);

  return (
    <div className="space-y-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
        {label}
      </p>
      <pre className="max-h-72 overflow-auto rounded-xl border border-border/30 bg-card/70 px-3 py-2.5 font-mono text-[11px] leading-5 text-foreground/82 whitespace-pre-wrap break-words scrollbar-thin">
        {content}
      </pre>
    </div>
  );
}

function TimelineDetailCard({
  item,
  detail,
  change,
  editorTheme,
}: {
  item: ExecutionData["timelineItems"][number];
  detail: ExecutionData["selectedTimelineDetail"];
  change: ExecutionData["changes"][number] | undefined;
  editorTheme: "vs" | "vs-dark";
}) {
  const parsedResult = safeJsonParse<Record<string, unknown>>(detail?.result);
  const resultValue = parsedResult ?? detail?.result;
  const payloadFacts = getPayloadFactEntries(detail?.payload);
  const primaryResultText = getPrimaryResultText(detail?.result);
  const todoItems = getTodoItems(detail?.payload);

  if (!detail && !change) return null;

  return (
    <div className="mt-3 space-y-4 rounded-2xl border border-border/40 bg-card/70 p-4 shadow-sm">
      {item.kind === "thinking" && detail?.payload?.content ? (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
            Reasoning
          </p>
          <div className="rounded-xl border border-border/30 bg-background/70 px-4 py-3 text-[13px] leading-6 text-foreground/85">
            {String(detail.payload.content)}
          </div>
        </div>
      ) : (
        <>
          {payloadFacts.length > 0 ? (
            <div className="grid gap-2 sm:grid-cols-2">
              {payloadFacts.map(([label, value]) => (
                <div
                  key={`${item.id}-${label}`}
                  className="rounded-xl border border-border/30 bg-background/70 px-3 py-2"
                >
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                    {label}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-foreground/85 break-words">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          ) : null}

          {todoItems.length > 0 ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                Todos
              </p>
              <div className="space-y-2 rounded-xl border border-border/30 bg-background/70 p-3">
                {todoItems.map((todo, index) => (
                  <div
                    key={`${item.id}-todo-${index}`}
                    className="flex items-start gap-2 text-xs"
                  >
                    <span
                      className={[
                        "mt-0.5 inline-flex h-5 min-w-5 items-center justify-center rounded-full border px-1.5 text-[10px] font-semibold uppercase",
                        todo.status === "completed"
                          ? "border-vibe-success/20 bg-vibe-success/10 text-vibe-success"
                          : todo.status === "in_progress"
                            ? "border-vibe-warning/20 bg-vibe-warning/10 text-vibe-warning"
                            : "border-border/30 bg-muted/40 text-muted-foreground",
                      ].join(" ")}
                    >
                      {todo.status === "completed"
                        ? "Done"
                        : todo.status === "in_progress"
                          ? "Now"
                          : "Todo"}
                    </span>
                    <p className="leading-5 text-foreground/85">
                      {todo.content}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {item.summary && item.kind !== "tool" ? (
            <p className="text-xs leading-5 text-muted-foreground/90">
              {item.summary}
            </p>
          ) : null}

          {change ? (
            <div className="overflow-hidden rounded-xl border border-border/40 bg-background/70 shadow-sm">
              <div className="flex items-center gap-2 border-b border-border/20 bg-muted/30 px-3 py-2">
                <FileCode2 className="size-3.5 text-primary" />
                <p className="truncate text-xs font-medium text-foreground/80">
                  {change.path}
                </p>
                <span className="ml-auto rounded-full border border-border/30 bg-background/80 px-2 py-0.5 text-[10px] font-semibold capitalize text-muted-foreground">
                  {change.status}
                </span>
              </div>
              <div className="h-64">
                <DiffEditor
                  key={`${item.id}-${change.path}`}
                  theme={editorTheme}
                  original={change.before}
                  modified={change.after}
                  language={detectLanguageFromPath(change.path)}
                  beforeMount={(monaco) => {
                    const uri = monaco.Uri.parse(
                      `inmemory://timeline/${item.id}/${change.path}`,
                    );
                    const existing = monaco.editor.getModel(uri);
                    if (existing) existing.dispose();
                  }}
                  options={{
                    readOnly: true,
                    minimap: { enabled: false },
                    renderSideBySide: false,
                    scrollBeyondLastLine: false,
                    lineNumbersMinChars: 3,
                    fontSize: 12,
                    padding: { top: 12 },
                  }}
                />
              </div>
            </div>
          ) : null}

          {detail?.payload &&
          Object.keys(detail.payload).length > 0 &&
          item.kind !== "thinking" &&
          payloadFacts.length === 0 &&
          todoItems.length === 0 ? (
            <TimelineJsonBlock label="Payload" value={detail.payload} />
          ) : null}

          {detail?.childLines?.length ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                Logs
              </p>
              <div className="space-y-1.5 rounded-xl border border-border/30 bg-background/70 px-3 py-2.5 font-mono text-[11px] leading-5 text-foreground/78 scrollbar-thin">
                {detail.childLines.map((line, index) => (
                  <p key={`${item.id}-line-${index}`}>{line}</p>
                ))}
              </div>
            </div>
          ) : null}

          {primaryResultText && !change ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/70">
                Result
              </p>
              <div className="rounded-xl border border-border/30 bg-background/70 px-4 py-3 text-[13px] leading-6 text-foreground/85 whitespace-pre-wrap break-words">
                {primaryResultText}
              </div>
            </div>
          ) : null}

          {resultValue && !change && typeof resultValue !== "string" ? (
            <details className="group rounded-xl border border-border/30 bg-background/60">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground transition-colors group-open:border-b group-open:border-border/20">
                View raw result
              </summary>
              <div className="px-3 pb-3">
                <TimelineJsonBlock label="Raw result" value={resultValue} />
              </div>
            </details>
          ) : null}

          {detail?.payload &&
          Object.keys(detail.payload).length > 0 &&
          payloadFacts.length > 0 ? (
            <details className="group rounded-xl border border-border/30 bg-background/60">
              <summary className="cursor-pointer list-none px-3 py-2 text-xs font-medium text-muted-foreground transition-colors group-open:border-b group-open:border-border/20">
                View raw payload
              </summary>
              <div className="px-3 pb-3">
                <TimelineJsonBlock label="Raw payload" value={detail.payload} />
              </div>
            </details>
          ) : null}

          {detail?.error ? (
            <div className="space-y-2">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-destructive/80">
                Error
              </p>
              <div className="rounded-xl border border-destructive/20 bg-destructive/8 px-3 py-2.5 font-mono text-[11px] leading-5 text-destructive">
                {detail.error}
              </div>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}

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
    changes,
    selectedChangePath,
    timelineItems,
    selectedTimelineId,
    setSelectedTimelineId,
    selectedChange,
    setSelectedChangePath,
  } = data;

  const reviewContainerRef = useRef<HTMLDivElement | null>(null);
  const reviewSectionRefs = useRef<Record<string, HTMLElement | null>>({});
  const skipNextReviewScrollRef = useRef(false);

  useEffect(() => {
    if (workspaceMode !== "review") return;
    if (!changes.length) return;

    const root = reviewContainerRef.current;
    if (!root) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visibleEntries = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);

        const nextPath = visibleEntries[0]?.target.getAttribute("data-path");
        if (!nextPath || nextPath === selectedChangePath) return;

        skipNextReviewScrollRef.current = true;
        setSelectedChangePath(nextPath);
      },
      {
        root,
        rootMargin: "-10% 0px -55% 0px",
        threshold: [0.15, 0.35, 0.6],
      },
    );

    const sections = Object.values(reviewSectionRefs.current);
    sections.forEach((section) => {
      if (section) observer.observe(section);
    });

    return () => observer.disconnect();
  }, [changes, selectedChangePath, setSelectedChangePath, workspaceMode]);

  useEffect(() => {
    if (workspaceMode !== "review") return;
    if (!selectedChangePath) return;

    if (skipNextReviewScrollRef.current) {
      skipNextReviewScrollRef.current = false;
      return;
    }

    const section = reviewSectionRefs.current[selectedChangePath];
    section?.scrollIntoView({ block: "start", behavior: "smooth" });
  }, [selectedChangePath, workspaceMode]);

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
      <div className="flex flex-1 overflow-y-auto px-4 py-4 md:px-6">
        <div className="mx-auto w-full max-w-4xl space-y-3">
          {timelineItems.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/40 bg-muted/20 px-4 py-12 text-center text-sm text-muted-foreground">
              Timeline will appear as execution events arrive.
            </div>
          ) : null}

          {timelineItems.map((item) => {
            const isSelected = selectedTimelineId === item.id;
            const detail = isSelected
              ? data.selectedTimelineItem?.id === item.id
                ? data.selectedTimelineDetail
                : null
              : null;
            const relatedChange = item.relatedPath
              ? data.changes.find((change) => change.path === item.relatedPath)
              : undefined;

            return (
              <div
                key={`${item.id}-${item.seq}`}
                className={[
                  "rounded-2xl border bg-card/55 shadow-sm transition-all",
                  isSelected
                    ? "border-border/60 bg-card"
                    : "border-border/30 hover:border-border/50 hover:bg-card/80",
                ].join(" ")}
              >
                <button
                  type="button"
                  onClick={() => {
                    setSelectedTimelineId(
                      item.id === selectedTimelineId ? null : item.id,
                    );
                    if (item.relatedPath) onOpenFile?.(item.relatedPath);
                  }}
                  className="w-full rounded-2xl text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                >
                  <div className="flex items-start gap-3 px-4 py-3">
                    <div className="relative flex shrink-0 flex-col items-center">
                      <div
                        className={[
                          "flex size-9 items-center justify-center rounded-xl border",
                          getTimelineIconTone(item),
                        ].join(" ")}
                      >
                        <KindIcon kind={item.kind} title={item.title} />
                      </div>
                      {!isSelected ? (
                        <div className="mt-2 h-6 w-px bg-border/50" />
                      ) : null}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1 pt-0.5">
                      <div className="flex items-center gap-2">
                        <p className="truncate text-sm font-medium text-foreground">
                          {getTimelineItemLabel(item)}
                        </p>
                        {item.status === "running" ||
                        item.status === "queued" ? (
                          <StatusIcon status={item.status} />
                        ) : null}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {getTimelinePreview(item)}
                      </p>
                      {item.kind === "thinking" && item.summary ? (
                        <p className="line-clamp-2 text-[12px] leading-5 text-foreground/75">
                          {item.summary}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 items-start gap-3 pl-3">
                      <div className="hidden text-right sm:block">
                        <div className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground/70">
                          {getTimelineStatusText(item)}
                        </div>
                        <div className="mt-1 text-[11px] text-muted-foreground/80 capitalize">
                          {item.status}
                        </div>
                      </div>
                      <ChevronDown
                        className={[
                          "mt-0.5 size-4 text-muted-foreground/60 transition-transform",
                          isSelected ? "rotate-180" : "rotate-0",
                        ].join(" ")}
                      />
                    </div>
                  </div>
                </button>

                {isSelected ? (
                  <div className="px-4 pb-4 pl-16">
                    <TimelineDetailCard
                      item={item}
                      detail={detail}
                      change={relatedChange}
                      editorTheme={editorTheme}
                    />
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
    );
  }

  if (workspaceMode === "review") {
    return (
      <div
        ref={reviewContainerRef}
        className="flex min-h-0 flex-1 flex-col overflow-y-auto bg-background"
      >
        {changes.length === 0 ? (
          <div className="flex h-full w-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            No changed files yet.
          </div>
        ) : (
          <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-4 md:px-6">
            {changes.map((change) => {
              const isActive = selectedChange?.path === change.path;

              return (
                <section
                  key={change.path}
                  id={getReviewSectionId(change.path)}
                  data-path={change.path}
                  ref={(node) => {
                    reviewSectionRefs.current[change.path] = node;
                  }}
                  className="overflow-hidden rounded-2xl border border-border/35 bg-card/45 shadow-sm"
                >
                  <div
                    className={[
                      "sticky top-0 z-10 flex items-center gap-3 border-b border-border/25 px-4 py-2.5 backdrop-blur supports-[backdrop-filter]:bg-background/85",
                      isActive ? "bg-background/95" : "bg-background/80",
                    ].join(" ")}
                  >
                    <FileCode2 className="size-4 shrink-0 text-primary" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {change.path.split("/").pop()}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">
                        {change.path}
                      </p>
                    </div>
                    <span className="rounded-full border border-border/30 bg-muted/40 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                      {change.status}
                    </span>
                  </div>
                  <div className="bg-background/50 p-2 md:p-3">
                    <DiffEditor
                      key={change.path}
                      height={getReviewDiffHeight(change)}
                      theme={editorTheme}
                      original={change.before}
                      modified={change.after}
                      language={detectLanguageFromPath(change.path)}
                      beforeMount={(monaco) => {
                        const uri = monaco.Uri.parse(
                          `inmemory://diff/${change.path}`,
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
                        padding: { top: 12 },
                      }}
                    />
                  </div>
                </section>
              );
            })}
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
            <KindIcon
              kind={selectedTimelineItem.kind}
              title={selectedTimelineItem.title}
            />
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
