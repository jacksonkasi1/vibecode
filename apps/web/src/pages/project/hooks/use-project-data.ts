// ** import core packages
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";

// ** import apis
import { getProject } from "@/rest-api/projects";
import { getWorkspaces } from "@/rest-api/workspaces";
import { getExecutions } from "@/rest-api/executions";
import { getArtifacts } from "@/rest-api/artifacts";

export function useProjectData(projectId: string) {
  // 1. Fetch Project
  const { data: projectRes, isLoading: isProjectLoading } = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId),
    enabled: !!projectId,
  });

  // 2. Fetch Workspaces
  const { data: workspacesRes, isLoading: isWorkspacesLoading } = useQuery({
    queryKey: ["workspaces", projectId],
    queryFn: () => getWorkspaces(projectId),
    enabled: !!projectId,
  });

  const project = projectRes?.data;
  const workspaces = workspacesRes?.data || [];
  const workspace = workspaces[0];

  // 3. Fetch Executions
  const { data: executionsRes, isLoading: isExecutionsLoading } = useQuery({
    queryKey: ["executions", workspace?.id],
    queryFn: () => getExecutions(workspace?.id),
    enabled: !!workspace?.id,
  });

  const executions = useMemo(() => {
    return (executionsRes?.data || []).sort(
      (a, b) =>
        new Date(String(a.createdAt)).getTime() -
        new Date(String(b.createdAt)).getTime(),
    );
  }, [executionsRes?.data]);

  const latestExecutionId = executions[executions.length - 1]?.id;

  // 4. Fetch Artifacts
  const { data: artifactsRes, isLoading: isArtifactsLoading } = useQuery({
    queryKey: ["artifacts", latestExecutionId],
    queryFn: () =>
      latestExecutionId
        ? getArtifacts(latestExecutionId)
        : Promise.resolve({ data: [] }),
    enabled: !!latestExecutionId,
  });

  const artifacts = artifactsRes?.data || [];

  return {
    project,
    workspace,
    executions,
    artifacts,
    isLoading: isProjectLoading || isWorkspacesLoading,
    isInitialLoading: isProjectLoading && !project,
    isExecutionsLoading,
    isArtifactsLoading,
  };
}
