// ** import lib
import { useState } from "react";
import {
  ArrowUp,
  Infinity,
  Compass,
  CircleUser,
  Cloud,
  Grid2X2,
  Paperclip,
  Plus,
  Settings,
} from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

// ** import rest-api
import { getProjects, createProject } from "@/rest-api/projects";
import { getModels } from "@/rest-api/models";

// ** import components
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { VibeMark, Panel } from "@/components/vibe-ui";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

// Remove hardcoded projects as we'll fetch them from the backend

const modeOptions = ["Agent", "Plan"] as const;
const modeIcons = {
  Agent: Infinity,
  Plan: Compass,
} as const;

// Remove hardcoded models as we'll fetch them from the backend

export default function Apps() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [selectedMode, setSelectedMode] = useState<(typeof modeOptions)[number]>(
    modeOptions[0]
  );
  const [selectedModel, setSelectedModel] = useState<string>("Loading models...");

  // Fetch Models
  const { data: modelsData } = useQuery({
    queryKey: ["models"],
    queryFn: () => getModels(),
  });
  
  const models = modelsData?.data || [];
  
  // Set default model when fetched
  if (models.length > 0 && selectedModel === "Loading models...") {
    setSelectedModel(models[0].displayName);
  }

  // Fetch Projects
  const { data: projectsData, isLoading: parsingProjects } = useQuery({
    queryKey: ["projects"],
    queryFn: () => getProjects(),
  });
  
  const projects = projectsData?.data || [];

  // Create Project Mutation
  const createProjectMutation = useMutation({
    mutationFn: () => createProject({ name: "Untitled Project", description: "A new fresh project workspace" }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      // Navigate to the new project view
      if (data.data?.id) {
        navigate(`/projects/${data.data.id}`);
      }
    },
  });

  const SelectedModeIcon = modeIcons[selectedMode];

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
                  placeholder="Enter the prompt"
                  className="max-h-32 min-h-[64px] w-full resize-none bg-transparent px-2 pt-1.5 text-[13px] leading-5 placeholder:text-muted-foreground focus:outline-none"
                />
                <div className="mt-1 flex items-center justify-between gap-2 px-1 pb-0.5">
                  <div className="flex items-center gap-1">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-6 items-center gap-1 rounded-md border border-border/50 bg-background/50 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
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
                          className="inline-flex h-6 items-center gap-1.5 rounded-md border border-border/50 bg-background/50 px-2 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          ✦ {selectedModel}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-56 text-[11px]"
                      >
                        {models.length === 0 ? (
                          <DropdownMenuItem className="px-2 py-1 text-[11px] disabled">
                            No models available
                          </DropdownMenuItem>
                        ) : (
                          models.map((model) => (
                            <DropdownMenuItem
                              className="px-2 py-1 text-[11px]"
                              key={model.id}
                              onClick={() => setSelectedModel(model.displayName)}
                            >
                              {model.displayName}
                            </DropdownMenuItem>
                          ))
                        )}
                      </DropdownMenuContent>
                    </DropdownMenu>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/50 bg-background/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Plus className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/50 bg-background/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Grid2X2 className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Paperclip className="h-3 w-3" />
                    </button>
                    <Link
                      to="/projects/1"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-background shadow-sm transition-opacity hover:opacity-90"
                    >
                      <ArrowUp className="h-3 w-3" />
                    </Link>
                  </div>
                </div>
              </div>
            </Panel>

            <div className="mb-8">
              <button
                type="button"
                onClick={() => createProjectMutation.mutate()}
                disabled={createProjectMutation.isPending}
                className="rounded-md border border-border/50 bg-background/50 px-2.5 py-1 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:opacity-50"
              >
                {createProjectMutation.isPending ? "Creating..." : "Create Blank Project"}
              </button>
            </div>

            <div className="mb-2.5 flex items-center justify-between px-1">
              <h2 className="text-[12px] font-medium text-muted-foreground">
                Recent projects
              </h2>
              <button
                type="button"
                className="text-[11px] text-muted-foreground transition-colors hover:text-foreground"
              >
                View all
              </button>
            </div>

            <div className="space-y-0.5">
              {parsingProjects ? (
                <div className="px-2 py-1.5 text-[13px] text-muted-foreground">Loading projects...</div>
              ) : projects.length === 0 ? (
                <div className="px-2 py-1.5 text-[13px] text-muted-foreground">No projects found. Create one to get started!</div>
              ) : (
                projects.map((project) => (
                  <Link
                    key={project.id}
                    to={`/projects/${project.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1.5 text-[13px] hover:bg-secondary/50 group"
                  >
                    <span className="text-foreground/90 font-medium group-hover:text-foreground transition-colors">{project.name}</span>
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                      <Cloud className="h-3 w-3" />
                      Cloud
                    </span>
                  </Link>
                ))
              )}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
