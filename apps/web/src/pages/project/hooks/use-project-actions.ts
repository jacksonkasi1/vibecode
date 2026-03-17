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
      const payload = parsed.data?.payload;
      if (!eventType || !payload) return;

      if (eventType === "status" && payload.status) {
        updateExecutionInCache(
          queryClient,
          workspaceId,
          executionId,
          (execution) => ({ ...execution, status: payload.status as any }),
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
            const existingText = readExecutionText(execution.result);
            const mergedText = existingText + assistantTextBuffer;

            return {
              ...execution,
              status: "running",
              result: JSON.stringify({
                text: mergedText,
                usage: payload.usage ?? null,
              }),
            };
          },
        );

        assistantTextBuffer = "";
      }

      if (eventType === "tool:result") {
        const toolName =
          typeof payload.name === "string" && payload.name.trim().length > 0
            ? payload.name
            : "tool";
        const rawResult =
          typeof payload.result === "string"
            ? payload.result
            : JSON.stringify(payload.result, null, 2);

        const toolOutput = [
          "",
          `Ran ${toolName}`,
          "```text",
          rawResult || "(no output)",
          "```",
          "",
        ].join("\n");

        updateExecutionInCache(
          queryClient,
          workspaceId,
          executionId,
          (execution) => {
            const existingText = readExecutionText(execution.result);

            return {
              ...execution,
              status: "running",
              result: JSON.stringify({
                text: `${existingText}${toolOutput}`,
                usage: payload.usage ?? null,
              }),
            };
          },
        );
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

  source.onerror = () => {
    source.close();
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
    }: {
      prompt: string;
      modelId?: string;
      threadId?: string;
    }) => {
      if (!workspaceId) throw new Error("Workspace not found");
      return createExecution({
        workspaceId,
        prompt,
        modelId,
        threadId,
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

  return {
    renameProject: renameProjectMutation.mutate,
    isRenaming: renameProjectMutation.isPending,
    runPrompt: runPromptMutation.mutate,
    isPromptRunning: runPromptMutation.isPending,
    undoToPrompt: undoPromptMutation.mutate,
    isUndoing: undoPromptMutation.isPending,
    cancelPrompt: cancelPromptMutation.mutate,
    isCanceling: cancelPromptMutation.isPending,
  };
}
