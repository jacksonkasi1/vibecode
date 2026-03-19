// ** import types
import type { AgentTask } from "@repo/db";
import type { FC } from "react";

// ** import core packages
import { useMemo } from "react";
import { Bot, CheckCircle2, XCircle, Clock, Loader2, Cpu } from "lucide-react";

// ─── Status badge ─────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<
  AgentTask["status"],
  { label: string; className: string; Icon: FC<{ className?: string }> }
> = {
  pending: {
    label: "Pending",
    className: "bg-muted/60 text-muted-foreground",
    Icon: Clock,
  },
  running: {
    label: "Running",
    className: "bg-blue-500/15 text-blue-500",
    Icon: Loader2,
  },
  completed: {
    label: "Done",
    className: "bg-emerald-500/15 text-emerald-500",
    Icon: CheckCircle2,
  },
  failed: {
    label: "Failed",
    className: "bg-destructive/15 text-destructive",
    Icon: XCircle,
  },
};

const AGENT_COLORS: Record<string, string> = {
  orchestrator: "text-violet-500",
  coder: "text-sky-500",
  frontend: "text-pink-500",
  backend: "text-amber-500",
  tester: "text-teal-500",
  researcher: "text-indigo-500",
  debugger: "text-rose-500",
};

// ─── Component ────────────────────────────────────────────────────────────────

interface AgentProgressProps {
  tasks: AgentTask[];
  /** If true, only show tasks that are running or failed */
  compact?: boolean;
}

/**
 * AgentProgress displays a grid of per-agent status cards
 * for all sub-agent tasks spawned by an orchestrator execution.
 */
export const AgentProgress: FC<AgentProgressProps> = ({
  tasks,
  compact = false,
}) => {
  const visibleTasks = useMemo(
    () =>
      compact
        ? tasks.filter((t) => t.status === "running" || t.status === "failed")
        : tasks,
    [tasks, compact],
  );

  if (visibleTasks.length === 0) return null;

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground/80">
        <Cpu className="size-3" />
        <span>
          {tasks.filter((t) => t.status === "completed").length}/{tasks.length}{" "}
          agents complete
        </span>
      </div>

      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {visibleTasks.map((task) => {
          const statusCfg = STATUS_STYLES[task.status] ?? STATUS_STYLES.pending;
          const { Icon: StatusIcon } = statusCfg;
          const agentColor =
            AGENT_COLORS[task.agentName] ?? "text-muted-foreground";

          return (
            <div
              key={task.id}
              className="flex items-start gap-2 rounded-lg border border-border/30 bg-card/60 px-2.5 py-2 text-xs"
            >
              <Bot className={`mt-0.5 size-3.5 shrink-0 ${agentColor}`} />

              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="font-semibold capitalize text-foreground/90">
                    {task.agentName}
                  </span>
                  <span
                    className={`inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium leading-none ${statusCfg.className}`}
                  >
                    <StatusIcon
                      className={`size-2.5 ${task.status === "running" ? "animate-spin" : ""}`}
                    />
                    {statusCfg.label}
                  </span>
                  {task.steps !== null && task.steps > 0 && (
                    <span className="ml-auto shrink-0 text-[10px] tabular-nums text-muted-foreground/60">
                      {task.steps} steps
                    </span>
                  )}
                </div>

                <p className="mt-0.5 line-clamp-2 text-muted-foreground/80">
                  {task.description}
                </p>

                {task.status === "failed" && task.errorMessage && (
                  <p className="mt-1 line-clamp-1 text-[10px] text-destructive/80">
                    {task.errorMessage}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
