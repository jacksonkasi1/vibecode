// ** import types
import type { TimelineStatus, TimelineKind } from "./execution-utils";

// ** import core packages
import {
  Bot,
  CheckCircle2,
  Clock3,
  FileEdit,
  FileText,
  FolderSearch,
  GitBranch,
  Lightbulb,
  ListTodo,
  Loader2,
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

export function KindIcon({
  kind,
  title,
}: {
  kind: TimelineKind;
  title?: string;
}) {
  if (kind === "thinking") {
    return <Lightbulb className="size-3.5 text-vibe-warning" />;
  }

  if (kind === "tool") {
    const t = (title || "").toLowerCase();
    if (t.includes("read") || t.includes("cat")) {
      return <FileText className="size-3.5 text-primary" />;
    }
    if (t.includes("write") || t.includes("edit")) {
      return <FileEdit className="size-3.5 text-vibe-success" />;
    }
    if (t.includes("bash") || t.includes("exec") || t.includes("terminal")) {
      return <TerminalSquare className="size-3.5 text-primary" />;
    }
    if (t.includes("todo")) {
      return <ListTodo className="size-3.5 text-primary" />;
    }
    if (t.includes("ls")) {
      return <FolderSearch className="size-3.5 text-primary" />;
    }

    return <Wrench className="size-3.5 text-muted-foreground/80" />;
  }

  if (kind === "task") {
    return <Bot className="size-3.5 text-primary" />;
  }
  if (kind === "status") {
    return <CheckCircle2 className="size-3.5 text-vibe-success" />;
  }

  return <Clock3 className="size-3.5 text-muted-foreground/80" />;
}
