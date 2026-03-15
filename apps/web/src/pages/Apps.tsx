// ** import types
import type { Project, Workspace } from "@repo/db";

// ** import lib
import { useEffect, useMemo, useState } from "react";
import {
  ArrowUp,
  CircleUser,
  Cloud,
  CloudOff,
  Compass,
  Cpu,
  Infinity,
  Loader2,
  Paperclip,
  Pencil,
  Plus,
  Settings,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ** import apis
import { createExecution } from "@/rest-api/executions";
import { getModels } from "@/rest-api/models";
import { createProject, getProjects, updateProject } from "@/rest-api/projects";
import {
  createWorkspace,
  getWorkspaces,
  updateWorkspace,
} from "@/rest-api/workspaces";

// ** import components
import { WorkspaceConfigCard } from "@/components/apps/workspace-config-card";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { VibeMark, Panel } from "@/components/vibe-ui";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ModeToggle } from "@/components/ui/mode-toggle";

// ** import utils
import {
  defaultResources,
  hasErrors,
  parseNumeric,
  parseWithMin,
  parseWorkspaceMetadata,
  presetFromResources,
  presetLabel,
  presetShortLabel,
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
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");

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

  const updateProjectMutation = useMutation({
    mutationFn: async ({
      projectId,
      name,
    }: {
      projectId: string;
      name: string;
    }) => {
      return updateProject(projectId, { name });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      setEditingProjectId(null);
      setEditingProjectName("");
    },
    onError: (error) => {
      toast.error(
        `Failed to rename project: ${error instanceof Error ? error.message : "Unknown error"}`,
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

  const handleStartEditingProject = (project: Project) => {
    setEditingProjectId(project.id);
    setEditingProjectName(project.name);
  };

  const handleCancelEditingProject = () => {
    setEditingProjectId(null);
    setEditingProjectName("");
  };

  const handleSaveProjectName = (project: Project) => {
    if (updateProjectMutation.isPending || editingProjectId !== project.id)
      return;

    const nextName = editingProjectName.trim();
    if (!nextName) {
      toast.error("Project name is required");
      return;
    }

    if (nextName === project.name) {
      handleCancelEditingProject();
      return;
    }

    updateProjectMutation.mutate({
      projectId: project.id,
      name: nextName,
    });
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

            <Panel className="mb-3 border-0 bg-transparent">
              <div className="rounded-lg border border-border bg-card p-1.5 shadow-sm transition-all focus-within:border-ring/40 focus-within:ring-1 focus-within:ring-ring/20">
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" && !event.shiftKey) {
                      event.preventDefault();
                      handlePromptSubmit();
                    }
                  }}
                  placeholder="Enter the prompt"
                  className="max-h-28 min-h-[56px] w-full resize-none bg-transparent px-2 pt-1 text-[13px] leading-5 placeholder:text-muted-foreground focus:outline-none"
                  disabled={executePromptMutation.isPending}
                />
                <div className="mt-1 flex items-center justify-between gap-2 px-1 pb-0.5">
                  <div className="flex items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border border-border/50 bg-background/50 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <SelectedModeIcon className="size-3" />
                          {selectedMode}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-32 text-[11px]"
                      >
                        {modeOptions.map((option) => (
                          <DropdownMenuItem
                            className="px-2 py-1 text-[11px]"
                            key={option}
                            onClick={() => setSelectedMode(option)}
                          >
                            {option === "Agent" ? (
                              <Infinity className="size-3" />
                            ) : (
                              <Compass className="size-3" />
                            )}
                            {option}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-md border border-border/50 bg-background/50 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          ✦ {selectedModelName}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-56 text-[11px]"
                      >
                        {isModelsLoading ? (
                          [0, 1, 2].map((item) => (
                            <DropdownMenuItem
                              key={`model-skeleton-${item}`}
                              className="px-2 py-1"
                              disabled
                            >
                              <span className="h-3 w-full animate-pulse rounded bg-muted" />
                            </DropdownMenuItem>
                          ))
                        ) : models.length === 0 ? (
                          <DropdownMenuItem
                            className="px-2 py-1 text-[11px]"
                            disabled
                          >
                            No models available
                          </DropdownMenuItem>
                        ) : (
                          models.map((model) => (
                            <DropdownMenuItem
                              className="px-2 py-1 text-[11px]"
                              key={model.id}
                              onClick={() => setSelectedModelId(model.id)}
                            >
                              {model.displayName}
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>

                    <button
                      type="button"
                      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md border border-border/50 bg-background/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setIsCreateConfigOpen((prev) => !prev)}
                      className={[
                        "inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/50 bg-background/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                        isCreateConfigOpen
                          ? "bg-secondary text-foreground"
                          : "",
                      ].join(" ")}
                      aria-label="Open create project config"
                    >
                      <Settings className="h-3 w-3" />
                    </button>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Paperclip className="h-3 w-3" />
                    </button>
                    <button
                      onClick={handlePromptSubmit}
                      disabled={
                        executePromptMutation.isPending || !prompt.trim()
                      }
                      className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-foreground text-background shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </Panel>

            <div className="mb-3">
              <button
                type="button"
                onClick={() => createProjectMutation.mutate()}
                disabled={createProjectMutation.isPending}
                className="cursor-pointer rounded-md border border-border/50 bg-background/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
              >
                {createProjectMutation.isPending
                  ? "Launching..."
                  : "Create Blank Project"}
              </button>
            </div>

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

            <div className="mb-2.5 flex items-center justify-between px-1">
              <h2 className="text-[12px] font-medium text-muted-foreground">
                Continue Existing Project
              </h2>
              <button
                type="button"
                onClick={() => {}}
                className="text-[11px] font-medium text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
              </button>
            </div>

            <div className="space-y-1">
              {isProjectsLoading ? (
                <div className="space-y-1">
                  {[0, 1, 2, 3].map((item) => (
                    <div
                      key={item}
                      className="flex items-center gap-1 px-1 py-1"
                    >
                      <div className="flex min-w-0 flex-1 items-center justify-between rounded-md border border-border/50 px-2 py-1.5">
                        <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                        <div className="h-5 w-36 animate-pulse rounded-md bg-muted" />
                      </div>
                      <div className="h-6 w-6 animate-pulse rounded-md bg-muted" />
                    </div>
                  ))}
                </div>
              ) : recentProjects.length === 0 ? (
                <div className="px-2 py-1.5 text-[13px] text-muted-foreground">
                  No projects found. Create one to get started.
                </div>
              ) : (
                recentProjects.map(({ project, workspace }) => {
                  const isEditingProject = editingProjectId === project.id;
                  const isOnline = workspace
                    ? ["running", "starting"].includes(workspace.status)
                    : false;
                  const metadata = parseWorkspaceMetadata(
                    workspace?.metadata ?? null,
                  );
                  const selectedResources =
                    metadata.resources ?? resourcesFromWorkspace(workspace);
                  const selectedPreset =
                    metadata.preset ?? presetFromResources(selectedResources);

                  return (
                    <div key={project.id}>
                      <div className="group flex items-center gap-1 px-1 py-1">
                        {isEditingProject ? (
                          <div className="flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px]">
                            <div className="min-w-0 flex flex-1 items-center gap-1.5">
                              <input
                                autoFocus
                                value={editingProjectName}
                                onChange={(event) =>
                                  setEditingProjectName(event.target.value)
                                }
                                onBlur={() => handleSaveProjectName(project)}
                                onKeyDown={(event) => {
                                  if (event.key === "Enter") {
                                    event.preventDefault();
                                    handleSaveProjectName(project);
                                  }

                                  if (event.key === "Escape") {
                                    event.preventDefault();
                                    handleCancelEditingProject();
                                  }
                                }}
                                className="min-w-0 flex-1 bg-transparent p-0 font-medium text-foreground/90 outline-none"
                              />
                              {updateProjectMutation.isPending ? (
                                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
                              ) : null}
                            </div>
                            <span
                              className={[
                                "ml-3 inline-flex shrink-0 items-center gap-2 text-[11px]",
                                isOnline
                                  ? "text-emerald-600"
                                  : "text-muted-foreground",
                              ].join(" ")}
                            >
                              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 px-1.5 py-0.5 text-muted-foreground">
                                <Cpu className="h-3 w-3" />
                                <span className="hidden lg:inline">
                                  {presetLabel(selectedPreset)}{" "}
                                  {selectedResources.cpu}
                                  CPU {selectedResources.ram}G{" "}
                                  {selectedResources.storage}G
                                </span>
                                <span className="lg:hidden">
                                  {presetShortLabel(selectedPreset)}{" "}
                                  {selectedResources.cpu}/
                                  {selectedResources.ram}/
                                  {selectedResources.storage}
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1">
                                {isOnline ? (
                                  <Cloud className="h-3 w-3" />
                                ) : (
                                  <CloudOff className="h-3 w-3" />
                                )}
                                <span className="hidden lg:inline">
                                  {isOnline ? "Cloud Online" : "Offline"}
                                </span>
                                <span className="lg:hidden">
                                  {isOnline ? "On" : "Off"}
                                </span>
                              </span>
                            </span>
                          </div>
                        ) : (
                          <div
                            role="button"
                            tabIndex={0}
                            onClick={() => {
                              if (quickContinueMutation.isPending) return;
                              quickContinueMutation.mutate(project.id);
                            }}
                            onKeyDown={(event) => {
                              if (event.key !== "Enter" && event.key !== " ")
                                return;
                              event.preventDefault();
                              if (quickContinueMutation.isPending) return;
                              quickContinueMutation.mutate(project.id);
                            }}
                            className={[
                              "flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-secondary/50",
                              quickContinueMutation.isPending
                                ? "cursor-not-allowed opacity-60"
                                : "cursor-pointer",
                            ].join(" ")}
                          >
                            <div className="min-w-0 flex items-center gap-1.5">
                              <div className="truncate font-medium text-foreground/90 transition-colors group-hover:text-foreground">
                                {project.name}
                              </div>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.preventDefault();
                                  event.stopPropagation();
                                  handleStartEditingProject(project);
                                }}
                                disabled={updateProjectMutation.isPending}
                                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-all hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                aria-label={`Rename ${project.name}`}
                              >
                                <Pencil className="h-3 w-3" />
                              </button>
                            </div>
                            <span
                              className={[
                                "ml-3 inline-flex shrink-0 items-center gap-2 text-[11px]",
                                isOnline
                                  ? "text-emerald-600"
                                  : "text-muted-foreground",
                              ].join(" ")}
                            >
                              <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 px-1.5 py-0.5 text-muted-foreground">
                                <Cpu className="h-3 w-3" />
                                <span className="hidden lg:inline">
                                  {presetLabel(selectedPreset)}{" "}
                                  {selectedResources.cpu}
                                  CPU {selectedResources.ram}G{" "}
                                  {selectedResources.storage}G
                                </span>
                                <span className="lg:hidden">
                                  {presetShortLabel(selectedPreset)}{" "}
                                  {selectedResources.cpu}/
                                  {selectedResources.ram}/
                                  {selectedResources.storage}
                                </span>
                              </span>
                              <span className="inline-flex items-center gap-1">
                                {isOnline ? (
                                  <Cloud className="h-3 w-3" />
                                ) : (
                                  <CloudOff className="h-3 w-3" />
                                )}
                                <span className="hidden lg:inline">
                                  {isOnline ? "Cloud Online" : "Offline"}
                                </span>
                                <span className="lg:hidden">
                                  {isOnline ? "On" : "Off"}
                                </span>
                              </span>
                            </span>
                          </div>
                        )}

                        <button
                          type="button"
                          onClick={() => handleOpenContinueConfig(project)}
                          className={[
                            "inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                            selectedProjectId === project.id
                              ? "bg-secondary text-foreground"
                              : "",
                          ].join(" ")}
                          aria-label={`Configure ${project.name}`}
                        >
                          <Settings className="h-3 w-3" />
                        </button>
                      </div>

                      {selectedProjectId === project.id ? (
                        <WorkspaceConfigCard
                          title="Continue Project"
                          className="mb-6 mt-1 rounded-lg border border-border bg-card p-3"
                          preset={continuePreset}
                          onPresetSelect={handleContinuePreset}
                          showCustomize={showContinueCustomize}
                          onToggleCustomize={() =>
                            setShowContinueCustomize((prev) => !prev)
                          }
                          inputs={continueInputs}
                          errors={continueErrors}
                          onInputChange={handleContinueInputChange}
                          resources={continueResources}
                          onCancel={() => setSelectedProjectId(null)}
                          onSubmit={() => {
                            if (
                              showContinueCustomize ||
                              continuePreset === "custom"
                            ) {
                              if (!syncContinueResourcesFromInputs()) return;
                            }
                            continueProjectMutation.mutate();
                          }}
                          submitLabel="Continue Project"
                          submittingLabel="Opening..."
                          isSubmitting={continueProjectMutation.isPending}
                        />
                      ) : null}
                    </div>
                  );
                })
              )}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
