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
  HardDrive,
  Infinity,
  Paperclip,
  Plus,
  Settings,
} from "lucide-react";
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

type WorkspacePreset = "small" | "medium" | "large" | "custom";
type ResourceKey = "cpu" | "ram" | "storage";

type WorkspaceResources = {
  cpu: number;
  ram: number;
  storage: number;
};

type WorkspaceMetadata = {
  preset?: WorkspacePreset;
  modelId?: string;
  location?: "cloud" | "local";
  resources?: WorkspaceResources;
};

type ResourceInputs = Record<ResourceKey, string>;
type ResourceErrors = Partial<Record<ResourceKey, string>>;

const modeOptions = ["Agent", "Plan"] as const;
const modeIcons = {
  Agent: Infinity,
  Plan: Compass,
} as const;

const resourceMins: Record<ResourceKey, number> = {
  cpu: 1,
  ram: 1,
  storage: 5,
};

const presetValues: Record<
  Exclude<WorkspacePreset, "custom">,
  WorkspaceResources
> = {
  small: { cpu: 2, ram: 4, storage: 10 },
  medium: { cpu: 4, ram: 8, storage: 20 },
  large: { cpu: 8, ram: 16, storage: 50 },
};

const presetCards = [
  ["small", "Small", "2 vCPU, 4GB, 10GB"],
  ["medium", "Medium", "4 vCPU, 8GB, 20GB"],
  ["large", "Large", "8 vCPU, 16GB, 50GB"],
  ["custom", "Custom", "Adjust"],
] as const;

const defaultResources = presetValues.medium;

function parseWorkspaceMetadata(metadata: string | null): WorkspaceMetadata {
  if (!metadata) return {};

  try {
    return JSON.parse(metadata) as WorkspaceMetadata;
  } catch {
    return {};
  }
}

function resourcesToInputs(resources: WorkspaceResources): ResourceInputs {
  return {
    cpu: String(resources.cpu),
    ram: String(resources.ram),
    storage: String(resources.storage),
  };
}

function resourcesFromWorkspace(workspace?: Workspace): WorkspaceResources {
  if (!workspace) return { ...defaultResources };

  const metadata = parseWorkspaceMetadata(workspace.metadata);
  const resources = metadata.resources;

  if (
    resources &&
    Number.isFinite(resources.cpu) &&
    Number.isFinite(resources.ram) &&
    Number.isFinite(resources.storage)
  ) {
    return {
      cpu: resources.cpu,
      ram: resources.ram,
      storage: resources.storage,
    };
  }

  return { ...defaultResources };
}

function presetFromResources(resources: WorkspaceResources): WorkspacePreset {
  if (
    resources.cpu === presetValues.small.cpu &&
    resources.ram === presetValues.small.ram &&
    resources.storage === presetValues.small.storage
  ) {
    return "small";
  }

  if (
    resources.cpu === presetValues.medium.cpu &&
    resources.ram === presetValues.medium.ram &&
    resources.storage === presetValues.medium.storage
  ) {
    return "medium";
  }

  if (
    resources.cpu === presetValues.large.cpu &&
    resources.ram === presetValues.large.ram &&
    resources.storage === presetValues.large.storage
  ) {
    return "large";
  }

  return "custom";
}

function parseNumeric(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) return null;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

function validateResourceInputs(inputs: ResourceInputs): ResourceErrors {
  const errors: ResourceErrors = {};

  (Object.keys(inputs) as ResourceKey[]).forEach((key) => {
    const raw = inputs[key].trim();
    if (!raw) {
      errors[key] = "Required";
      return;
    }

    const parsed = parseNumeric(raw);
    if (parsed === null) {
      errors[key] = "Numbers only";
      return;
    }

    if (parsed < resourceMins[key]) {
      errors[key] = `Min ${resourceMins[key]}`;
    }
  });

  return errors;
}

function hasErrors(errors: ResourceErrors): boolean {
  return Boolean(errors.cpu || errors.ram || errors.storage);
}

function parseWithMin(value: string, key: ResourceKey): number {
  const parsed = parseNumeric(value);
  if (parsed === null) return resourceMins[key];
  return Math.max(parsed, resourceMins[key]);
}

function presetLabel(preset: WorkspacePreset): string {
  if (preset === "small") return "Small";
  if (preset === "medium") return "Medium";
  if (preset === "large") return "Large";
  return "Custom";
}

function presetShortLabel(preset: WorkspacePreset): string {
  if (preset === "small") return "S";
  if (preset === "medium") return "M";
  if (preset === "large") return "L";
  return "C";
}

function ResourceInputsForm({
  inputs,
  errors,
  onInputChange,
}: {
  inputs: ResourceInputs;
  errors: ResourceErrors;
  onInputChange: (key: ResourceKey, value: string) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
      {(
        [
          ["cpu", "CPU"],
          ["ram", "RAM (GB)"],
          ["storage", "Storage (GB)"],
        ] as const
      ).map(([key, label]) => (
        <label key={key} className="text-[11px] text-muted-foreground">
          {label}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={inputs[key]}
            onChange={(event) => onInputChange(key, event.target.value)}
            className="mt-1 h-7 w-full rounded-md border border-border/60 bg-background px-2 text-[11px] text-foreground"
          />
          {errors[key] ? (
            <span className="mt-1 block text-[10px] text-destructive">
              {errors[key]}
            </span>
          ) : null}
        </label>
      ))}
    </div>
  );
}

function WorkspaceConfigCard({
  title,
  preset,
  onPresetSelect,
  showCustomize,
  onToggleCustomize,
  inputs,
  errors,
  onInputChange,
  resources,
  onCancel,
  onSubmit,
  submitLabel,
  submittingLabel,
  isSubmitting,
  className,
}: {
  title?: string;
  preset: WorkspacePreset;
  onPresetSelect: (preset: WorkspacePreset) => void;
  showCustomize: boolean;
  onToggleCustomize: () => void;
  inputs: ResourceInputs;
  errors: ResourceErrors;
  onInputChange: (key: ResourceKey, value: string) => void;
  resources: WorkspaceResources;
  onCancel: () => void;
  onSubmit: () => void;
  submitLabel: string;
  submittingLabel: string;
  isSubmitting: boolean;
  className: string;
}) {
  return (
    <div className={className}>
      {title ? <h3 className="mb-2 text-[12px] font-medium">{title}</h3> : null}

      <p className="mb-2 text-[11px] text-muted-foreground">Workspace preset</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {presetCards.map(([value, label, summary]) => (
          <button
            key={value}
            type="button"
            onClick={() => onPresetSelect(value)}
            className={[
              "rounded-md border px-2 py-1.5 text-left transition-colors",
              preset === value
                ? "border-foreground/40 bg-secondary text-foreground"
                : "border-border/60 text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
            ].join(" ")}
          >
            <div className="text-[11px] font-medium">{label}</div>
            <div className="text-[10px]">{summary}</div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onToggleCustomize}
        className="mt-2 text-[11px] text-muted-foreground hover:text-foreground"
      >
        Customize
      </button>

      {showCustomize || preset === "custom" ? (
        <ResourceInputsForm
          inputs={inputs}
          errors={errors}
          onInputChange={onInputChange}
        />
      ) : null}

      <div className="mt-3 flex items-center justify-between">
        <div className="inline-flex items-center gap-2 text-[11px] text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Cpu className="h-3 w-3" /> {resources.cpu} vCPU
          </span>
          <span>{resources.ram}GB RAM</span>
          <span className="inline-flex items-center gap-1">
            <HardDrive className="h-3 w-3" /> {resources.storage}GB
          </span>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-border/60 px-2.5 py-1 text-[11px] text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="rounded-md bg-foreground px-2.5 py-1 text-[11px] text-background disabled:opacity-60"
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

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

  const { data: modelsData } = useQuery({
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
    "Gemini 3.1 Pro";

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
                        {models.length === 0 ? (
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
                <div className="px-2 py-1.5 text-[13px] text-muted-foreground">
                  Loading projects...
                </div>
              ) : recentProjects.length === 0 ? (
                <div className="px-2 py-1.5 text-[13px] text-muted-foreground">
                  No projects found. Create one to get started.
                </div>
              ) : (
                recentProjects.map(({ project, workspace }) => {
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
                      <div className="flex items-center gap-1 px-1 py-1">
                        <button
                          type="button"
                          onClick={() =>
                            quickContinueMutation.mutate(project.id)
                          }
                          disabled={quickContinueMutation.isPending}
                          className="group flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-secondary/50 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          <div className="truncate font-medium text-foreground/90 transition-colors group-hover:text-foreground">
                            {project.name}
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
                                {selectedResources.cpu}/{selectedResources.ram}/
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
                        </button>

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
