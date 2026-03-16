// ** import types
import type { Workspace } from "@repo/db";
import type { RecentProjectItem } from "@/pages/apps/types";

// ** import core packages
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";

// ** import apis
import { getModels } from "@/rest-api/models";
import { getProjects } from "@/rest-api/projects";
import { getWorkspaces } from "@/rest-api/workspaces";

export function useAppsData() {
  const [selectedModelId, setSelectedModelId] = useState("");

  const { data: models = [], isLoading: isModelsLoading } = useQuery({
    queryKey: ["models"],
    queryFn: () => getModels().then((res) => res.data),
    initialData: [],
  });

  const { data: projectsData, isLoading: isProjectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
  });

  const { data: workspacesData } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => getWorkspaces(),
  });

  const projects = projectsData?.data || [];
  const workspaces = workspacesData?.data || [];

  useEffect(() => {
    if (models.length > 0 && !selectedModelId) {
      setSelectedModelId(models[0].id);
    }
  }, [models, selectedModelId]);

  const selectedModelName =
    models.find((model) => model.id === selectedModelId)?.displayName ||
    (isModelsLoading ? "Loading models..." : "Select model");

  const latestWorkspaceByProject = useMemo(() => {
    return workspaces.reduce<Record<string, Workspace>>((acc, workspace) => {
      const current = acc[workspace.projectId];
      if (!current) {
        acc[workspace.projectId] = workspace;
        return acc;
      }

      const currentTime = new Date(String(current.updatedAt)).getTime();
      const nextTime = new Date(String(workspace.updatedAt)).getTime();

      if (nextTime >= currentTime) {
        acc[workspace.projectId] = workspace;
      }

      return acc;
    }, {});
  }, [workspaces]);

  const recentProjects = useMemo<RecentProjectItem[]>(() => {
    return projects
      .map((project) => {
        const workspace = latestWorkspaceByProject[project.id];
        return { project, workspace };
      })
      .sort((a, b) => a.project.name.localeCompare(b.project.name));
  }, [projects, latestWorkspaceByProject]);

  return {
    models,
    isModelsLoading,
    selectedModelId,
    setSelectedModelId,
    selectedModelName,
    isProjectsLoading,
    latestWorkspaceByProject,
    recentProjects,
  };
}
