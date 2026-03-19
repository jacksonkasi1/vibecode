// ** import types
import type { TimelineStatus, TimelineKind } from "./execution-utils";

// ** import core packages
import {
  Bot,
  CheckCircle2,
  Clock3,
  GitBranch,
  Loader2,
  Sparkles,
  TerminalSquare,
  TriangleAlert,
  Wrench,
} from "lucide-react";

export function StatusIcon({ status }: { status: TimelineStatus }) {
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

export function KindIcon({ kind }: { kind: TimelineKind }) {
  if (kind === "thinking") return <Sparkles className="size-3.5" />;
  if (kind === "tool") return <Wrench className="size-3.5" />;
  if (kind === "task") return <Bot className="size-3.5" />;
  if (kind === "status") return <TerminalSquare className="size-3.5" />;
  return <Clock3 className="size-3.5" />;
}
