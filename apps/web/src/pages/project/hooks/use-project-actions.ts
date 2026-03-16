// ** import core packages
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ** import apis
import { updateProject } from "@/rest-api/projects";
import { createExecution } from "@/rest-api/executions";

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
    }: {
      prompt: string;
      modelId?: string;
    }) => {
      if (!workspaceId) throw new Error("Workspace not found");
      return createExecution({
        workspaceId,
        prompt,
        modelId,
      });
    },
    onSuccess: (response) => {
      queryClient.setQueryData(["executions", workspaceId], (prev: any) => {
        const current = prev?.data ?? [];
        return {
          data: [...current, response.data],
        };
      });

      queryClient.invalidateQueries({ queryKey: ["executions", workspaceId] });
    },
    onError: (error) => {
      toast.error(
        `Failed to start execution: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    },
  });

  return {
    renameProject: renameProjectMutation.mutate,
    isRenaming: renameProjectMutation.isPending,
    runPrompt: runPromptMutation.mutate,
    isPromptRunning: runPromptMutation.isPending,
  };
}
