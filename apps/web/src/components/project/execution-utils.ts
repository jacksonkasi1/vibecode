// ** import types
import type { AgentTask, Artifact, Execution, ExecutionEvent } from "@repo/db";

export type TimelineKind = "run" | "thinking" | "tool" | "task" | "status";
export type TimelineStatus =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "conflicted"
  | "cancelled"
  | "pending";

export type TimelineItem = {
  id: string;
  kind: TimelineKind;
  title: string;
  summary?: string;
  status: TimelineStatus;
  seq: number;
  startedAt?: string;
  endedAt?: string;
  relatedPath?: string;
};

export type TimelineItemDetail = {
  payload?: Record<string, unknown>;
  result?: string;
  error?: string;
  childLines?: string[];
};

export type FileChange = {
  path: string;
  status: "added" | "modified" | "deleted";
  before: string;
  after: string;
};

export function safeJsonParse<T>(value: string | null | undefined): T | null {
  if (!value) return null;
  try {
    return JSON.parse(value) as T;
  } catch {
    return null;
  }
}

export function readArtifactContent(artifact: Artifact | null | undefined) {
  const parsed = safeJsonParse<{ content?: unknown }>(artifact?.metadata);
  return typeof parsed?.content === "string" ? parsed.content : "";
}

export function readExecutionText(execution: Execution | null | undefined) {
  const parsed = safeJsonParse<{ text?: unknown }>(execution?.result);
  return typeof parsed?.text === "string" ? parsed.text : "";
}

export function formatDateTime(
  value: Date | string | null | undefined,
  showSeconds = false,
) {
  if (!value) return "-";
  return new Date(String(value)).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    ...(showSeconds ? { second: "2-digit" } : {}),
  });
}

export function formatDuration(
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

export function summarizeArgs(args: Record<string, unknown>) {
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

export function extractRelatedPath(args: Record<string, unknown>) {
  const candidates = [args.filePath, args.path];
  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.trim()) {
      return candidate.trim();
    }
  }
  return undefined;
}

export function deriveTimelineData(
  events: ExecutionEvent[],
  tasks: AgentTask[],
) {
  const items: TimelineItem[] = [];
  const details: Record<string, TimelineItemDetail> = {};
  const tools = new Map<string, TimelineItem>();
  const taskItems = new Map<string, TimelineItem>();

  const ensureDetail = (id: string) => {
    details[id] ||= {};
    return details[id];
  };

  for (const event of events) {
    const payload =
      event.payloadJson && typeof event.payloadJson === "object"
        ? (event.payloadJson as Record<string, unknown>)
        : {};

    if (event.type === "editor:context") continue;

    if (event.type === "run:start") {
      const id = `run-${event.seq}`;
      items.push({
        id,
        kind: "run",
        title: "Execution started",
        summary: `Using ${String(payload.runtime || "agent runtime")}`,
        status: "running",
        seq: event.seq,
        startedAt: String(event.createdAt),
      });
      ensureDetail(id).payload = payload;
      continue;
    }

    if (event.type === "agent:thinking") {
      const id = `thinking-${event.seq}`;
      items.push({
        id,
        kind: "thinking",
        title: String(payload.label || "Reasoning"),
        summary:
          typeof payload.summary === "string" ? payload.summary : undefined,
        status: "completed",
        seq: event.seq,
        startedAt: String(event.createdAt),
      });
      ensureDetail(id).payload = payload;
      continue;
    }

    if (event.type === "tool:call") {
      const args =
        payload.args && typeof payload.args === "object"
          ? (payload.args as Record<string, unknown>)
          : {};
      const id = String(payload.id || `tool-${event.seq}`);
      const name = String(payload.name || "tool");
      const item: TimelineItem = {
        id,
        kind: "tool",
        title: name,
        summary: summarizeArgs(args) || "Tool call",
        status: "running",
        seq: event.seq,
        startedAt: String(event.createdAt),
        relatedPath: extractRelatedPath(args),
      };
      items.push(item);
      ensureDetail(id).payload = args;
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
        const detail = ensureDetail(id);
        detail.result = event.type === "tool:error" ? undefined : resultText;
        detail.error = event.type === "tool:error" ? resultText : undefined;
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
      };
      items.push(item);
      ensureDetail(taskId).payload = payload;
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
        const detail = ensureDetail(taskId);
        if (
          event.type === "task:update" &&
          typeof payload.content === "string"
        ) {
          detail.childLines = [
            ...(detail.childLines || []),
            payload.content,
          ].slice(-6);
        }
        if (event.type === "task:complete") {
          item.status = "completed";
          item.endedAt = String(event.createdAt);
          detail.result =
            typeof payload.result === "string" ? payload.result : undefined;
        }
        if (event.type === "task:error") {
          item.status = "failed";
          item.endedAt = String(event.createdAt);
          detail.error =
            typeof payload.errorMessage === "string"
              ? payload.errorMessage
              : "Sub-agent failed";
        }
      }
      continue;
    }

    if (event.type === "status") {
      const status = String(payload.status || "completed") as TimelineStatus;
      const id = `status-${event.seq}`;
      items.push({
        id,
        kind: "status",
        title:
          status === "conflicted"
            ? "Execution completed with conflict"
            : status === "failed"
              ? "Execution failed"
              : status === "cancelled"
                ? "Execution cancelled"
                : "Execution completed",
        summary:
          typeof payload.errorMessage === "string"
            ? payload.errorMessage
            : undefined,
        status,
        seq: event.seq,
        startedAt: String(event.createdAt),
      });
      ensureDetail(id).payload = payload;
    }
  }

  for (const task of tasks) {
    const existing = taskItems.get(task.id);
    if (!existing) {
      details[task.id] = {
        result: task.result || undefined,
        error: task.errorMessage || undefined,
      };
      items.push({
        id: task.id,
        kind: "task",
        title: task.agentName,
        summary: task.description,
        status: task.status === "pending" ? "pending" : task.status,
        seq: Number.MAX_SAFE_INTEGER,
        startedAt: String(task.createdAt),
        endedAt: task.completedAt ? String(task.completedAt) : undefined,
      });
    }
  }

  return {
    items: items.sort((left, right) => left.seq - right.seq),
    details,
  };
}

export function deriveFileChanges(
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

export function detectLanguageFromPath(path: string) {
  const lower = path.toLowerCase();
  if (lower.endsWith(".tsx") || lower.endsWith(".ts")) return "typescript";
  if (lower.endsWith(".jsx") || lower.endsWith(".js")) return "javascript";
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".css")) return "css";
  if (lower.endsWith(".md")) return "markdown";
  if (lower.endsWith(".html")) return "html";
  return "plaintext";
}
