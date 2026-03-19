// ** import core packages
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ** import types
import type { Execution } from "@repo/db";

// ** import apis
import { updateProject } from "@/rest-api/projects";
import {
  createExecution,
  cancelExecution,
  undoExecution,
} from "@/rest-api/executions";
import { renameThread, deleteThread, restoreThread } from "@/rest-api/threads";

// ** import utils
import { useUndoStack } from "@/lib/undo-stack";

const API_BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8080";

function readExecutionText(result: string | null): string {
  if (!result) return "";

  try {
    const parsed = JSON.parse(result) as { text?: unknown };
    return typeof parsed.text === "string" ? parsed.text : "";
  } catch {
    return "";
  }
}

function readExecutionResult(result: string | null): {
  text: string;
  usage?: unknown;
  current?: string;
  live?: string[];
} {
  if (!result) return { text: "", live: [] };

  try {
    const parsed = JSON.parse(result) as {
      text?: unknown;
      usage?: unknown;
      current?: unknown;
      live?: unknown;
    };

    return {
      text:
        typeof parsed.text === "string"
          ? parsed.text
          : readExecutionText(result),
      usage: parsed.usage,
      current: typeof parsed.current === "string" ? parsed.current : undefined,
      live: Array.isArray(parsed.live)
        ? parsed.live.filter((item): item is string => typeof item === "string")
        : [],
    };
  } catch {
    return { text: readExecutionText(result), live: [] };
  }
}

function buildLiveLabel(eventType: string, payload: Record<string, unknown>) {
  const args =
    payload.args && typeof payload.args === "object"
      ? (payload.args as Record<string, unknown>)
      : {};
  const detail = (...values: Array<unknown>) => {
    for (const value of values) {
      if (typeof value === "string" && value.trim()) return value.trim();
    }
    return "";
  };

  if (eventType === "run:start") return "Starting agent runtime";
  if (eventType === "runtime:selected")
    return `Using ${String(payload.runtime || "agent runtime")}`;
  if (eventType === "agent:thinking")
    return String(payload.label || "Thinking");
  if (eventType === "tool:call") {
    const name = String(payload.name || "tool");
    const summary = detail(
      args.command,
      args.filePath,
      args.path,
      args.pattern,
      args.url,
      args.description,
    );
    return summary ? `${name}: ${summary}` : `Running ${name}`;
  }
  if (eventType === "tool:result")
    return `Finished ${String(payload.name || "tool")}`;
  if (eventType === "tool:error")
    return `Failed ${String(payload.name || "tool")}`;
  if (eventType === "task:start")
    return `Started ${String(payload.agentName || "subagent")}: ${String(payload.description || "Working")}`;
  if (eventType === "task:update")
    return String(payload.content || "Subagent working");
  if (eventType === "task:complete") return "Subagent finished";
  if (eventType === "task:error")
    return String(payload.errorMessage || "Subagent failed");
  return "";
}

function updateExecutionInCache(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  executionId: string,
  updater: (execution: Execution) => Execution,
) {
  queryClient.setQueryData(["executions", workspaceId], (prev: any) => {
    const current = Array.isArray(prev?.data) ? (prev.data as Execution[]) : [];
    return {
      data: current.map((execution) =>
        execution.id === executionId ? updater(execution) : execution,
      ),
    };
  });
}

function openExecutionStream(
  queryClient: ReturnType<typeof useQueryClient>,
  workspaceId: string,
  executionId: string,
) {
  let assistantTextBuffer = "";

  const source = new EventSource(
    `${API_BASE_URL}/api/executions/${executionId}/stream`,
    { withCredentials: true },
  );

  source.addEventListener("execution:event", (event) => {
    try {
      const parsed = JSON.parse((event as MessageEvent).data) as {
        data?: {
          eventType?: string;
          payload?: {
            status?: string;
            content?: string;
            name?: string;
            result?: unknown;
            usage?: unknown;
          };
        };
      };

      const eventType = parsed.data?.eventType;
      const payload = (parsed.data?.payload || {}) as Record<string, unknown>;
      if (!eventType || !payload) return;

      if (eventType === "status" && payload.status) {
        updateExecutionInCache(
          queryClient,
          workspaceId,
          executionId,
          (execution) => ({ ...execution, status: payload.status as any }),
        );
      }

      const liveLabel = buildLiveLabel(eventType, payload);
      if (liveLabel) {
        updateExecutionInCache(
          queryClient,
          workspaceId,
          executionId,
          (execution) => {
            const current = readExecutionResult(execution.result);
            const live = [...(current.live || []), liveLabel].slice(-8);

            return {
              ...execution,
              status:
                execution.status === "queued" ? "running" : execution.status,
              result: JSON.stringify({
                text: current.text,
                usage: current.usage ?? null,
                current: liveLabel,
                live,
              }),
            };
          },
        );
      }

      if (
        eventType === "assistant:delta" &&
        typeof payload.content === "string"
      ) {
        assistantTextBuffer += payload.content;

        updateExecutionInCache(
          queryClient,
          workspaceId,
          executionId,
          (execution) => {
            const current = readExecutionResult(execution.result);
            const existingText = current.text;
            const mergedText = existingText + assistantTextBuffer;

            return {
              ...execution,
              status: "running",
              result: JSON.stringify({
                text: mergedText,
                usage: payload.usage ?? null,
                current: current.current ?? "Responding",
                live: current.live ?? [],
              }),
            };
          },
        );

        assistantTextBuffer = "";
      }

      if (
        eventType === "task:start" ||
        eventType === "task:update" ||
        eventType === "task:complete" ||
        eventType === "task:error"
      ) {
        queryClient.invalidateQueries({
          queryKey: ["agent-tasks", executionId],
        });
      }
    } catch {
      // ignore malformed stream event payload
    }
  });

  source.addEventListener("execution:completed", (event) => {
    try {
      const parsed = JSON.parse((event as MessageEvent).data) as {
        data?: {
          id?: string;
          status?: string;
          result?: unknown;
          errorMessage?: string | null;
        };
      };

      updateExecutionInCache(
        queryClient,
        workspaceId,
        executionId,
        (execution) => ({
          ...execution,
          status: (parsed.data?.status || "completed") as any,
          result:
            parsed.data?.result !== undefined
              ? JSON.stringify(parsed.data.result)
              : execution.result,
          errorMessage: parsed.data?.errorMessage ?? execution.errorMessage,
        }),
      );
    } catch {
      // ignore malformed completion payload
    }

    queryClient.invalidateQueries({ queryKey: ["artifacts", executionId] });

    source.close();
  });

  source.addEventListener("execution:failed", (event) => {
    try {
      const parsed = JSON.parse((event as MessageEvent).data) as {
        data?: { status?: string; errorMessage?: string | null };
      };

      updateExecutionInCache(
        queryClient,
        workspaceId,
        executionId,
        (execution) => ({
          ...execution,
          status: (parsed.data?.status || "failed") as any,
          errorMessage: parsed.data?.errorMessage ?? execution.errorMessage,
        }),
      );
    } catch {
      // ignore malformed failure payload
    }

    queryClient.invalidateQueries({ queryKey: ["artifacts", executionId] });

    source.close();
  });

  source.addEventListener("execution:conflicted", (event) => {
    try {
      const parsed = JSON.parse((event as MessageEvent).data) as {
        data?: {
          status?: string;
          result?: unknown;
          errorMessage?: string | null;
        };
      };

      updateExecutionInCache(
        queryClient,
        workspaceId,
        executionId,
        (execution) => ({
          ...execution,
          status: (parsed.data?.status || "conflicted") as any,
          result:
            parsed.data?.result !== undefined
              ? JSON.stringify(parsed.data.result)
              : execution.result,
          errorMessage: parsed.data?.errorMessage ?? execution.errorMessage,
        }),
      );
    } catch {
      // ignore malformed conflict payload
    }

    queryClient.invalidateQueries({ queryKey: ["artifacts", executionId] });

    source.close();
  });

  source.onerror = () => {
    updateExecutionInCache(
      queryClient,
      workspaceId,
      executionId,
      (execution) => {
        if (execution.status !== "running" && execution.status !== "queued") {
          return execution;
        }

        const current = readExecutionResult(execution.result);
        return {
          ...execution,
          result: JSON.stringify({
            text: current.text,
            usage: current.usage ?? null,
            current: "Stream disconnected. Refreshing execution status...",
            live: [
              ...(current.live || []),
              "Stream disconnected. Refreshing execution status...",
            ].slice(-8),
          }),
        };
      },
    );

    queryClient.invalidateQueries({ queryKey: ["executions", workspaceId] });
  };
}

type UseProjectActionsOptions = {
  projectId: string;
  workspaceId?: string;
};

export function useProjectActions({
  projectId,
  workspaceId,
}: UseProjectActionsOptions) {
  const queryClient = useQueryClient();
  const { push: pushUndo } = useUndoStack();

  const renameProjectMutation = useMutation({
    mutationFn: (newName: string) =>
      updateProject(projectId, { name: newName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["project", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error) => {
      toast.error(
        `Failed to rename: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    },
  });

  const runPromptMutation = useMutation({
    mutationFn: async ({
      prompt,
      modelId,
      threadId,
      editorContext,
    }: {
      prompt: string;
      modelId?: string;
      threadId?: string;
      editorContext?: {
        activeFilePath?: string;
        visibleContent?: string;
      };
    }) => {
      if (!workspaceId) throw new Error("Workspace not found");
      return createExecution({
        workspaceId,
        prompt,
        modelId,
        threadId,
        editorContext,
      });
    },
    onSuccess: (response) => {
      queryClient.setQueryData(["executions", workspaceId], (prev: any) => {
        const current = prev?.data ?? [];
        return {
          data: [...current, response.data],
        };
      });

      queryClient.invalidateQueries({ queryKey: ["threads", workspaceId] });

      if (workspaceId) {
        openExecutionStream(queryClient, workspaceId, response.data.id);
      }

      queryClient.invalidateQueries({ queryKey: ["executions", workspaceId] });
    },
    onError: (error) => {
      toast.error(
        `Failed to start execution: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    },
  });

  const undoPromptMutation = useMutation({
    mutationFn: (executionId: string) => undoExecution(executionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["executions", workspaceId] });
      queryClient.invalidateQueries({ queryKey: ["artifacts"] });
      toast.success("Successfully reverted codebase to selected prompt");
    },
    onError: (error) => {
      toast.error(
        `Failed to revert codebase: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    },
  });

  const cancelPromptMutation = useMutation({
    mutationFn: (executionId: string) => cancelExecution(executionId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["executions", workspaceId] });
    },
    onError: (error) => {
      toast.error(
        `Failed to cancel execution: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    },
  });

  const renameThreadMutation = useMutation({
    mutationFn: ({ threadId, title }: { threadId: string; title: string }) =>
      renameThread(threadId, title),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["threads", workspaceId] });
    },
    onError: (error) => {
      toast.error(
        `Failed to rename thread: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    },
  });

  const deleteThreadMutation = useMutation({
    mutationFn: async (threadId: string) => {
      // Optimistically remove from cache immediately
      queryClient.setQueryData(["threads", workspaceId], (prev: any) => {
        const current = Array.isArray(prev?.data) ? prev.data : [];
        return { data: current.filter((t: any) => t.id !== threadId) };
      });

      // Push onto the undo stack. The actual DELETE call only fires after the
      // 10-second window expires (onCommit). If the user presses Cmd+Z within
      // that window, onRestore is called instead.
      pushUndo({
        id: threadId,
        label: "Thread deleted",
        onCommit: async () => {
          await deleteThread(threadId);
          queryClient.invalidateQueries({ queryKey: ["threads", workspaceId] });
        },
        onRestore: async () => {
          await restoreThread(threadId);
          queryClient.invalidateQueries({ queryKey: ["threads", workspaceId] });
        },
      });
    },
    onError: (error) => {
      toast.error(
        `Failed to delete thread: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      // Re-fetch on error to restore correct state
      queryClient.invalidateQueries({ queryKey: ["threads", workspaceId] });
    },
  });

  return {
    renameProject: renameProjectMutation.mutate,
    isRenaming: renameProjectMutation.isPending,
    runPrompt: runPromptMutation.mutate,
    isPromptRunning: runPromptMutation.isPending,
    undoToPrompt: undoPromptMutation.mutate,
    isUndoing: undoPromptMutation.isPending,
    cancelPrompt: cancelPromptMutation.mutate,
    isCanceling: cancelPromptMutation.isPending,
    renameThread: renameThreadMutation.mutate,
    deleteThread: deleteThreadMutation.mutate,
  };
}
