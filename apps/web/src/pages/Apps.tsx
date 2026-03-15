// ** import types
import type { Project, Workspace } from "@repo/db";

// ** import lib
import { useEffect, useMemo, useState } from "react";
import { CircleUser, Compass, Infinity, Settings } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ** import apis
import { createExecution } from "@/rest-api/executions";
import { getModels } from "@/rest-api/models";
import { createProject, getProjects } from "@/rest-api/projects";
import {
  createWorkspace,
  getWorkspaces,
  updateWorkspace,
} from "@/rest-api/workspaces";

// ** import components
import { WorkspaceConfigCard } from "@/components/apps/workspace-config-card";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { ContinueProjectsSection } from "@/pages/apps/components/continue-projects-section";
import { PromptComposer } from "@/pages/apps/components/prompt-composer";
import { VibeMark } from "@/components/vibe-ui";
import { Button } from "@/components/ui/button";
import { ModeToggle } from "@/components/ui/mode-toggle";

// ** import utils
import {
  defaultResources,
  hasErrors,
  parseNumeric,
  parseWithMin,
  parseWorkspaceMetadata,
  presetFromResources,
  presetValues,
  resourceMins,
  resourcesFromWorkspace,
  resourcesToInputs,
  validateResourceInputs,
} from "@/lib/workspace-config";
import type {
  ResourceInputs,
  ResourceKey,
  WorkspaceMetadata,
  WorkspacePreset,
  WorkspaceResources,
} from "@/lib/workspace-config";

const modeOptions = ["Agent", "Plan"] as const;
const modeIcons = {
  Agent: Infinity,
  Plan: Compass,
} as const;

export default function Apps() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedMode, setSelectedMode] = useState<
    (typeof modeOptions)[number]
  >(modeOptions[0]);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [prompt, setPrompt] = useState("");

  const [isCreateConfigOpen, setIsCreateConfigOpen] = useState(false);
  const [createPreset, setCreatePreset] = useState<WorkspacePreset>("medium");
  const [createResources, setCreateResources] = useState<WorkspaceResources>({
    ...defaultResources,
  });
  const [createInputs, setCreateInputs] = useState<ResourceInputs>(
    resourcesToInputs(defaultResources),
  );
  const [showCreateCustomize, setShowCreateCustomize] = useState(false);

  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(
    null,
  );
  const [continuePreset, setContinuePreset] =
    useState<WorkspacePreset>("medium");
  const [continueResources, setContinueResources] =
    useState<WorkspaceResources>({
      ...defaultResources,
    });
  const [continueInputs, setContinueInputs] = useState<ResourceInputs>(
    resourcesToInputs(defaultResources),
  );
  const [showContinueCustomize, setShowContinueCustomize] = useState(false);

  const createErrors = useMemo(
    () => validateResourceInputs(createInputs),
    [createInputs],
  );
  const continueErrors = useMemo(
    () => validateResourceInputs(continueInputs),
    [continueInputs],
  );

  const { data: modelsData, isLoading: isModelsLoading } = useQuery({
    queryKey: ["models"],
    queryFn: () => getModels(),
  });

  const { data: projectsData, isLoading: isProjectsLoading } = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
  });

  const { data: workspacesData } = useQuery({
    queryKey: ["workspaces"],
    queryFn: () => getWorkspaces(),
  });

  const models = modelsData?.data || [];
  const projects = projectsData?.data || [];
  const workspaces = workspacesData?.data || [];

  useEffect(() => {
    if (models.length > 0 && !selectedModelId) {
      setSelectedModelId(models[0].id);
    }
  }, [models, selectedModelId]);

  const SelectedModeIcon = modeIcons[selectedMode];
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

  const recentProjects = useMemo(() => {
    return projects
      .map((project) => {
        const workspace = latestWorkspaceByProject[project.id];
        return { project, workspace };
      })
      .sort((a, b) => a.project.name.localeCompare(b.project.name));
  }, [projects, latestWorkspaceByProject]);

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

  const handleCreatePreset = (preset: WorkspacePreset) => {
    setCreatePreset(preset);

    if (preset === "custom") {
      setShowCreateCustomize(true);
      return;
    }

    setShowCreateCustomize(false);

    const resources = { ...presetValues[preset] };
    setCreateResources(resources);
    setCreateInputs(resourcesToInputs(resources));
  };

  const handleContinuePreset = (preset: WorkspacePreset) => {
    setContinuePreset(preset);

    if (preset === "custom") {
      setShowContinueCustomize(true);
      return;
    }

    setShowContinueCustomize(false);

    const resources = { ...presetValues[preset] };
    setContinueResources(resources);
    setContinueInputs(resourcesToInputs(resources));
  };

  const handleCreateInputChange = (key: ResourceKey, value: string) => {
    setCreateInputs((prev) => ({ ...prev, [key]: value }));

    const parsed = parseNumeric(value);
    if (parsed === null) return;

    setCreateResources((prev) => ({
      ...prev,
      [key]: Math.max(parsed, resourceMins[key]),
    }));
  };

  const handleContinueInputChange = (key: ResourceKey, value: string) => {
    setContinueInputs((prev) => ({ ...prev, [key]: value }));

    const parsed = parseNumeric(value);
    if (parsed === null) return;

    setContinueResources((prev) => ({
      ...prev,
      [key]: Math.max(parsed, resourceMins[key]),
    }));
  };

  const syncCreateResourcesFromInputs = () => {
    if (hasErrors(createErrors)) {
      toast.error("Fix invalid resource values first");
      return false;
    }

    const nextResources: WorkspaceResources = {
      cpu: parseWithMin(createInputs.cpu, "cpu"),
      ram: parseWithMin(createInputs.ram, "ram"),
      storage: parseWithMin(createInputs.storage, "storage"),
    };

    setCreateResources(nextResources);
    setCreateInputs(resourcesToInputs(nextResources));
    setCreatePreset(presetFromResources(nextResources));

    return true;
  };

  const syncContinueResourcesFromInputs = () => {
    if (hasErrors(continueErrors)) {
      toast.error("Fix invalid resource values first");
      return false;
    }

    const nextResources: WorkspaceResources = {
      cpu: parseWithMin(continueInputs.cpu, "cpu"),
      ram: parseWithMin(continueInputs.ram, "ram"),
      storage: parseWithMin(continueInputs.storage, "storage"),
    };

    setContinueResources(nextResources);
    setContinueInputs(resourcesToInputs(nextResources));
    setContinuePreset(presetFromResources(nextResources));

    return true;
  };

  const handleOpenContinueConfig = (project: Project) => {
    if (selectedProjectId === project.id) {
      setSelectedProjectId(null);
      return;
    }

    const workspace = latestWorkspaceByProject[project.id];
    const resources = resourcesFromWorkspace(workspace);
    const preset = presetFromResources(resources);

    setSelectedProjectId(project.id);
    setContinuePreset(preset);
    setContinueResources(resources);
    setContinueInputs(resourcesToInputs(resources));
    setShowContinueCustomize(false);
  };

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-8 pt-5 sm:px-6">
          <header className="mb-6 flex items-center justify-end gap-2">
            <ModeToggle />
            <Button variant="ghost" size="icon-xs" asChild>
              <Link
                to="/account/ai-model-settings"
                aria-label="AI model settings"
              >
                <Settings className="h-3.5 w-3.5" />
                <span className="sr-only">AI model settings</span>
              </Link>
            </Button>
            <Button variant="ghost" size="icon-xs" asChild>
              <Link to="/account/settings" aria-label="Account settings">
                <CircleUser className="h-3.5 w-3.5" />
                <span className="sr-only">Account settings</span>
              </Link>
            </Button>
          </header>

          <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col pt-4 sm:pt-8">
            <div className="mb-6 flex items-center justify-center gap-2">
              <VibeMark className="h-5 w-5" />
              <h1 className="text-lg font-medium tracking-tight">vibe</h1>
            </div>

            <PromptComposer
              prompt={prompt}
              onPromptChange={setPrompt}
              onPromptSubmit={handlePromptSubmit}
              isPromptSubmitting={executePromptMutation.isPending}
              selectedMode={selectedMode}
              selectedModeIcon={SelectedModeIcon}
              modeOptions={modeOptions}
              onSelectMode={setSelectedMode}
              selectedModelName={selectedModelName}
              models={models}
              isModelsLoading={isModelsLoading}
              onSelectModel={setSelectedModelId}
              isCreateConfigOpen={isCreateConfigOpen}
              onToggleCreateConfig={() =>
                setIsCreateConfigOpen((prev) => !prev)
              }
              onCreateBlankProject={() => createProjectMutation.mutate()}
              isCreatingBlankProject={createProjectMutation.isPending}
            />

            {isCreateConfigOpen ? (
              <WorkspaceConfigCard
                className="mb-6 rounded-lg border border-border bg-card p-3"
                preset={createPreset}
                onPresetSelect={handleCreatePreset}
                showCustomize={showCreateCustomize}
                onToggleCustomize={() =>
                  setShowCreateCustomize((prev) => !prev)
                }
                inputs={createInputs}
                errors={createErrors}
                onInputChange={handleCreateInputChange}
                resources={createResources}
                onCancel={() => setIsCreateConfigOpen(false)}
                onSubmit={() => {
                  if (showCreateCustomize || createPreset === "custom") {
                    if (!syncCreateResourcesFromInputs()) return;
                  }
                  createProjectMutation.mutate();
                }}
                submitLabel="Launch"
                submittingLabel="Launching..."
                isSubmitting={createProjectMutation.isPending}
              />
            ) : null}

            <ContinueProjectsSection
              recentProjects={recentProjects}
              isProjectsLoading={isProjectsLoading}
              selectedProjectId={selectedProjectId}
              onOpenContinueConfig={handleOpenContinueConfig}
              quickContinuePending={quickContinueMutation.isPending}
              onQuickContinue={(projectId) =>
                quickContinueMutation.mutate(projectId)
              }
              continuePreset={continuePreset}
              onContinuePresetSelect={handleContinuePreset}
              showContinueCustomize={showContinueCustomize}
              onToggleContinueCustomize={() =>
                setShowContinueCustomize((prev) => !prev)
              }
              continueInputs={continueInputs}
              continueErrors={continueErrors}
              onContinueInputChange={handleContinueInputChange}
              continueResources={continueResources}
              onContinueCancel={() => setSelectedProjectId(null)}
              onContinueSubmit={() => {
                if (showContinueCustomize || continuePreset === "custom") {
                  if (!syncContinueResourcesFromInputs()) return;
                }
                continueProjectMutation.mutate();
              }}
              continueSubmitting={continueProjectMutation.isPending}
            />
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
