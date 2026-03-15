// ** import types
import type { Workspace } from "@repo/db";
import type {
  WorkspaceMetadata,
  WorkspacePreset,
  WorkspaceResources,
} from "@/lib/workspace-config";

// ** import core packages
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

// ** import apis
import { createExecution } from "@/rest-api/executions";
import { createProject } from "@/rest-api/projects";
import { createWorkspace, updateWorkspace } from "@/rest-api/workspaces";

// ** import utils
import {
  defaultResources,
  parseWorkspaceMetadata,
} from "@/lib/workspace-config";

type UseAppsActionsOptions = {
  selectedModelId: string;
  createPreset: WorkspacePreset;
  createResources: WorkspaceResources;
  selectedProjectId: string | null;
  continuePreset: WorkspacePreset;
  continueResources: WorkspaceResources;
  latestWorkspaceByProject: Record<string, Workspace>;
};

export function useAppsActions({
  selectedModelId,
  createPreset,
  createResources,
  selectedProjectId,
  continuePreset,
  continueResources,
  latestWorkspaceByProject,
}: UseAppsActionsOptions) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");

  const createProjectMutation = useMutation({
    mutationFn: async () => {
      const projectRes = await createProject({
        name: "Untitled Project",
        description: "A new fresh project workspace",
      });

      const workspaceRes = await createWorkspace({
        projectId: projectRes.data.id,
        name: "Default Workspace",
        branch: "main",
      });

      await updateWorkspace(workspaceRes.data.id, {
        metadata: {
          preset: createPreset,
          modelId: selectedModelId,
          location: "cloud",
          resources: createResources,
        },
      });

      return projectRes.data.id;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      navigate(`/projects/${projectId}`);
    },
    onError: (error) => {
      toast.error(
        `Failed to create project: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    },
  });

  const quickContinueMutation = useMutation({
    mutationFn: async (projectId: string) => {
      const existingWorkspace = latestWorkspaceByProject[projectId];
      if (!existingWorkspace) {
        const workspaceRes = await createWorkspace({
          projectId,
          name: "Default Workspace",
          branch: "main",
        });

        await updateWorkspace(workspaceRes.data.id, {
          metadata: {
            preset: "medium",
            location: "cloud",
            resources: defaultResources,
          },
        });
      }

      return projectId;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      navigate(`/projects/${projectId}`);
    },
    onError: (error) => {
      toast.error(
        `Failed to open project: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    },
  });

  const continueProjectMutation = useMutation({
    mutationFn: async () => {
      if (!selectedProjectId) throw new Error("Project not selected");

      const existingWorkspace = latestWorkspaceByProject[selectedProjectId];
      const currentMetadata = parseWorkspaceMetadata(
        existingWorkspace?.metadata ?? null,
      );

      const nextMetadata: WorkspaceMetadata = {
        preset: continuePreset,
        resources: continueResources,
        location: currentMetadata.location || "cloud",
        modelId: currentMetadata.modelId,
      };

      if (existingWorkspace) {
        await updateWorkspace(existingWorkspace.id, {
          metadata: nextMetadata,
        });
      } else {
        const workspaceRes = await createWorkspace({
          projectId: selectedProjectId,
          name: "Default Workspace",
          branch: "main",
        });

        await updateWorkspace(workspaceRes.data.id, {
          metadata: nextMetadata,
        });
      }

      return selectedProjectId;
    },
    onSuccess: (projectId) => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      navigate(`/projects/${projectId}`);
    },
    onError: (error) => {
      toast.error(
        `Failed to continue project: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    },
  });

  const executePromptMutation = useMutation({
    mutationFn: async () => {
      if (!prompt.trim()) throw new Error("Prompt is required");

      toast.loading("Creating project...", { id: "prompt-exec" });

      const projectRes = await createProject({
        name: "Untitled Project",
        description: prompt.substring(0, 100),
      });

      const workspaceRes = await createWorkspace({
        projectId: projectRes.data.id,
        name: "Default Workspace",
        branch: "main",
      });

      await updateWorkspace(workspaceRes.data.id, {
        metadata: {
          preset: "medium",
          modelId: selectedModelId,
          location: "cloud",
          resources: defaultResources,
        },
      });

      toast.loading("Starting execution...", { id: "prompt-exec" });
      await createExecution({
        workspaceId: workspaceRes.data.id,
        prompt: prompt.trim(),
        modelId: selectedModelId,
      });

      return projectRes.data.id;
    },
    onSuccess: (projectId) => {
      toast.success("Project created successfully!", { id: "prompt-exec" });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      navigate(`/projects/${projectId}`);
      setPrompt("");
    },
    onError: (error) => {
      toast.error(
        `Failed to start: ${error instanceof Error ? error.message : "Unknown error"}`,
        { id: "prompt-exec" },
      );
    },
  });

  const handlePromptSubmit = () => {
    if (prompt.trim() && !executePromptMutation.isPending) {
      executePromptMutation.mutate();
    }
  };

  return {
    prompt,
    setPrompt,
    createProjectMutation,
    quickContinueMutation,
    continueProjectMutation,
    executePromptMutation,
    handlePromptSubmit,
  };
}
