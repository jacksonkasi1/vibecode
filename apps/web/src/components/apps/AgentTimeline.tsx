// ** import types
import type { AgentTask } from "@repo/db";
import type { FC } from "react";

// ** import core packages
import { useState } from "react";
import {
  Bot,
  CheckCircle2,
  XCircle,
  Clock,
  Loader2,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(task: AgentTask): string | null {
  if (!task.createdAt) return null;
  const start = new Date(String(task.createdAt)).getTime();
  const end = task.completedAt
    ? new Date(String(task.completedAt)).getTime()
    : Date.now();
  const seconds = Math.round((end - start) / 1000);
  if (seconds < 60) return `${seconds}s`;
  return `${Math.floor(seconds / 60)}m ${seconds % 60}s`;
}

function formatTime(date: Date | string | null | undefined): string {
  if (!date) return "";
  return new Date(String(date)).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

const STATUS_ICON: Record<AgentTask["status"], FC<{ className?: string }>> = {
  pending: Clock,
  running: Loader2,
  completed: CheckCircle2,
  failed: XCircle,
};

const STATUS_COLOR: Record<AgentTask["status"], string> = {
  pending: "text-muted-foreground/60",
  running: "text-blue-500",
  completed: "text-emerald-500",
  failed: "text-destructive",
};

const AGENT_COLORS: Record<string, string> = {
  orchestrator: "bg-violet-500/20 text-violet-600 border-violet-500/20",
  coder: "bg-sky-500/20 text-sky-600 border-sky-500/20",
  frontend: "bg-pink-500/20 text-pink-600 border-pink-500/20",
  backend: "bg-amber-500/20 text-amber-600 border-amber-500/20",
  tester: "bg-teal-500/20 text-teal-600 border-teal-500/20",
  researcher: "bg-indigo-500/20 text-indigo-600 border-indigo-500/20",
  debugger: "bg-rose-500/20 text-rose-600 border-rose-500/20",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface AgentTimelineProps {
  tasks: AgentTask[];
  /** Execution start time for alignment */
  executionStartedAt?: Date | string | null;
}

/**
 * AgentTimeline renders a collapsible per-agent event timeline
 * showing the lifecycle (start → steps → result) of each sub-agent task.
 */
export const AgentTimeline: FC<AgentTimelineProps> = ({ tasks }) => {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  if (tasks.length === 0) return null;

  const toggle = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  return (
    <div className="flex flex-col gap-px">
      {tasks.map((task, idx) => {
        const isExpanded = expandedIds.has(task.id);
        const isLast = idx === tasks.length - 1;
        const StatusIcon = STATUS_ICON[task.status] ?? Clock;
        const statusColor = STATUS_COLOR[task.status] ?? STATUS_COLOR.pending;
        const agentBadge =
          AGENT_COLORS[task.agentName] ??
          "bg-muted/40 text-muted-foreground border-border/30";
        const duration = formatDuration(task);

        return (
          <div key={task.id} className="relative flex gap-3">
            {/* Vertical connector line */}
            {!isLast && (
              <div className="absolute left-[13px] top-7 bottom-0 w-px bg-border/40" />
            )}

            {/* Status icon column */}
            <div className="relative mt-1 shrink-0">
              <div
                className={`flex size-7 items-center justify-center rounded-full border border-border/30 bg-background ${statusColor}`}
              >
                <StatusIcon
                  className={`size-3.5 ${task.status === "running" ? "animate-spin" : ""}`}
                />
              </div>
            </div>

            {/* Content */}
            <div className="mb-3 min-w-0 flex-1">
              {/* Row header */}
              <button
                type="button"
                className="flex w-full items-center gap-2 text-left"
                onClick={() => toggle(task.id)}
              >
                <span
                  className={`inline-flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${agentBadge}`}
                >
                  <Bot className="size-2.5" />
                  {task.agentName}
                </span>

                <span className="flex-1 truncate text-xs text-foreground/85">
                  {task.description}
                </span>

                <div className="flex shrink-0 items-center gap-1.5 text-[10px] text-muted-foreground/60">
                  {duration && <span>{duration}</span>}
                  {task.steps !== null && task.steps > 0 && (
                    <span>{task.steps} steps</span>
                  )}
                  {isExpanded ? (
                    <ChevronDown className="size-3" />
                  ) : (
                    <ChevronRight className="size-3" />
                  )}
                </div>
              </button>

              {/* Collapsed sub-info */}
              {!isExpanded && (
                <p className="mt-0.5 truncate text-[11px] text-muted-foreground/60">
                  {formatTime(task.createdAt)}
                  {task.completedAt && ` → ${formatTime(task.completedAt)}`}
                </p>
              )}

              {/* Expanded detail panel */}
              {isExpanded && (
                <div className="mt-1.5 rounded-md border border-border/25 bg-muted/20 p-2.5 text-xs">
                  <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[10px] text-muted-foreground/70">
                    <span>
                      Started:{" "}
                      <span className="text-foreground/80">
                        {formatTime(task.createdAt)}
                      </span>
                    </span>
                    {task.completedAt && (
                      <span>
                        Finished:{" "}
                        <span className="text-foreground/80">
                          {formatTime(task.completedAt)}
                        </span>
                      </span>
                    )}
                    {task.steps !== null && (
                      <span>
                        Steps:{" "}
                        <span className="text-foreground/80">{task.steps}</span>
                      </span>
                    )}
                  </div>

                  {/* Prompt snippet */}
                  {task.prompt && (
                    <details className="mt-2">
                      <summary className="cursor-pointer select-none text-[10px] font-medium text-muted-foreground hover:text-foreground">
                        Prompt
                      </summary>
                      <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded border border-border/20 bg-background/60 p-2 text-[10px] leading-relaxed text-foreground/80 scrollbar-thin">
                        {task.prompt}
                      </pre>
                    </details>
                  )}

                  {/* Result snippet */}
                  {task.result && task.status === "completed" && (
                    <details className="mt-1.5">
                      <summary className="cursor-pointer select-none text-[10px] font-medium text-muted-foreground hover:text-foreground">
                        Result
                      </summary>
                      <pre className="mt-1 max-h-40 overflow-y-auto whitespace-pre-wrap break-words rounded border border-border/20 bg-background/60 p-2 text-[10px] leading-relaxed text-foreground/80 scrollbar-thin">
                        {(() => {
                          try {
                            const parsed = JSON.parse(task.result);
                            return typeof parsed?.text === "string"
                              ? parsed.text
                              : task.result;
                          } catch {
                            return task.result;
                          }
                        })()}
                      </pre>
                    </details>
                  )}

                  {/* Error */}
                  {task.status === "failed" && task.errorMessage && (
                    <p className="mt-1.5 rounded bg-destructive/10 px-2 py-1 text-[10px] text-destructive">
                      {task.errorMessage}
                    </p>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};
