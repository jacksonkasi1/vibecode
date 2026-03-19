// ** import types
import type { Execution } from "@repo/db";

// ** import core packages
import { Clock3, Dot, GitMerge, SquareTerminal } from "lucide-react";

// ** import utils
import { formatDateTime } from "./execution-utils";
import { getWorkspaceStatusLabel } from "./workspace-types";

function summarizePrompt(execution: Execution) {
  const text = (execution.taskDescription || execution.prompt || "Untitled run")
    .replace(/\n?\[EDITOR CONTEXT\][\s\S]*?\[\/EDITOR CONTEXT\]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return text || "Untitled run";
}

export function ExecutionHistory({
  executions,
  selectedExecutionId,
  onSelectExecution,
}: {
  executions: Execution[];
  selectedExecutionId: string | null;
  onSelectExecution: (executionId: string) => void;
}) {
  if (executions.length === 0) {
    return (
      <div className="border-b border-border/30 px-3 py-2.5 text-[11px] text-muted-foreground/70">
        Runs in this thread appear here once generation starts.
      </div>
    );
  }

  return (
    <div className="border-b border-border/30 bg-card/20 px-2.5 py-2">
      <div className="mb-2 flex items-center justify-between px-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground/60">
        <span>Runs</span>
        <span>{executions.length}</span>
      </div>

      <div className="max-h-40 space-y-1 overflow-y-auto pr-1 scrollbar-thin">
        {[...executions].reverse().map((execution, index) => {
          const isSelected = execution.id === selectedExecutionId;
          const isLatest = index === 0;
          const isMerged = Boolean(execution.mergedCommitHash);

          return (
            <button
              key={execution.id}
              type="button"
              onClick={() => onSelectExecution(execution.id)}
              className={[
                "w-full rounded-lg border px-2.5 py-2 text-left transition-colors",
                isSelected
                  ? "border-primary/35 bg-primary/8 text-foreground"
                  : "border-transparent bg-transparent text-foreground/88 hover:border-border/40 hover:bg-secondary/20",
              ].join(" ")}
            >
              <div className="flex items-center gap-2 text-[10px] uppercase tracking-[0.16em] text-muted-foreground/65">
                <SquareTerminal className="size-3" />
                <span>
                  {isLatest ? "Latest" : `Run ${executions.length - index}`}
                </span>
                <Dot className="size-3" />
                <span>{getWorkspaceStatusLabel(execution)}</span>
                {isMerged ? (
                  <>
                    <Dot className="size-3" />
                    <GitMerge className="size-3" />
                  </>
                ) : null}
              </div>

              <div className="mt-1 line-clamp-2 text-xs leading-5 text-foreground/88">
                {summarizePrompt(execution)}
              </div>

              <div className="mt-1.5 flex items-center gap-1.5 text-[10px] text-muted-foreground/60">
                <Clock3 className="size-3" />
                <span>{formatDateTime(execution.createdAt)}</span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
