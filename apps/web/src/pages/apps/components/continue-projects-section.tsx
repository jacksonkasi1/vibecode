// ** import types
import type { Project, Workspace } from "@repo/db";
import type {
  ResourceErrors,
  ResourceInputs,
  ResourceKey,
  WorkspacePreset,
  WorkspaceResources,
} from "@/lib/workspace-config";
import type { RecentProjectItem } from "@/pages/apps/types";

// ** import core packages
import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

// ** import apis
import { deleteProject, updateProject } from "@/rest-api/projects";
import { stopWorkspace } from "@/rest-api/workspaces";

// ** import components
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProjectActionsMenu } from "@/pages/apps/components/project-actions-menu";
import { ProjectRow } from "@/pages/apps/components/project-row";

type ContinueProjectsSectionProps = {
  recentProjects: RecentProjectItem[];
  isProjectsLoading: boolean;
  selectedProjectId: string | null;
  onOpenContinueConfig: (project: Project) => void;
  quickContinuePending: boolean;
  onQuickContinue: (projectId: string) => void;
  continuePreset: WorkspacePreset;
  onContinuePresetSelect: (preset: WorkspacePreset) => void;
  showContinueCustomize: boolean;
  onToggleContinueCustomize: () => void;
  continueInputs: ResourceInputs;
  continueErrors: ResourceErrors;
  onContinueInputChange: (key: ResourceKey, value: string) => void;
  continueResources: WorkspaceResources;
  onContinueCancel: () => void;
  onContinueSubmit: () => void;
  continueSubmitting: boolean;
};

export function ContinueProjectsSection({
  recentProjects,
  isProjectsLoading,
  selectedProjectId,
  onOpenContinueConfig,
  quickContinuePending,
  onQuickContinue,
  continuePreset,
  onContinuePresetSelect,
  showContinueCustomize,
  onToggleContinueCustomize,
  continueInputs,
  continueErrors,
  onContinueInputChange,
  continueResources,
  onContinueCancel,
  onContinueSubmit,
  continueSubmitting,
}: ContinueProjectsSectionProps) {
  const queryClient = useQueryClient();
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editingProjectName, setEditingProjectName] = useState("");
  const [projectActionsMenu, setProjectActionsMenu] = useState<{
    projectId: string;
    x: number;
    y: number;
  } | null>(null);
  const [deleteConfirmProjectId, setDeleteConfirmProjectId] = useState<
    string | null
  >(null);

  const menuRef = useRef<HTMLDivElement | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const suppressQuickOpenUntilRef = useRef(0);

  const projectsById = useMemo(() => {
    return recentProjects.reduce<Record<string, Project>>((acc, item) => {
      acc[item.project.id] = item.project;
      return acc;
    }, {});
  }, [recentProjects]);

  const workspaceByProject = useMemo(() => {
    return recentProjects.reduce<Record<string, Workspace>>((acc, item) => {
      if (item.workspace) {
        acc[item.project.id] = item.workspace;
      }
      return acc;
    }, {});
  }, [recentProjects]);

  useEffect(() => {
    if (!projectActionsMenu) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (menuRef.current?.contains(event.target as Node)) return;
      setProjectActionsMenu(null);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setProjectActionsMenu(null);
      }
    };

    window.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [projectActionsMenu]);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current === null) return;
    window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };

  useEffect(() => {
    return () => {
      clearLongPressTimer();
    };
  }, []);

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

  const deleteProjectMutation = useMutation({
    mutationFn: async (projectId: string) => {
      return deleteProject(projectId);
    },
    onSuccess: (_response, projectId) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      setDeleteConfirmProjectId(null);

      if (selectedProjectId === projectId) {
        onContinueCancel();
      }

      if (editingProjectId === projectId) {
        setEditingProjectId(null);
        setEditingProjectName("");
      }

      toast.success("Project deleted");
    },
    onError: (error) => {
      toast.error(
        `Failed to delete project: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    },
  });

  const stopWorkspaceMutation = useMutation({
    mutationFn: async (workspaceId: string) => {
      return stopWorkspace(workspaceId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["workspaces"] });
      toast.success("Workspace stopping...");
    },
    onError: (error) => {
      toast.error(
        `Failed to stop workspace: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    },
  });

  const disableActions =
    updateProjectMutation.isPending ||
    deleteProjectMutation.isPending ||
    stopWorkspaceMutation.isPending;

  const handleOpenProjectActionsMenu = (
    project: Project,
    x: number,
    y: number,
  ) => {
    const menuWidth = 168;
    const menuHeight = 132;
    const nextX = Math.min(Math.max(8, x), window.innerWidth - menuWidth - 8);
    const nextY = Math.min(Math.max(8, y), window.innerHeight - menuHeight - 8);

    setProjectActionsMenu({
      projectId: project.id,
      x: nextX,
      y: nextY,
    });
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

    updateProjectMutation.mutate({ projectId: project.id, name: nextName });
  };

  const handleMenuRename = () => {
    if (!projectActionsMenu) return;

    const project = projectsById[projectActionsMenu.projectId];
    if (!project) return;

    setProjectActionsMenu(null);
    handleStartEditingProject(project);
  };

  const handleMenuStop = () => {
    if (!projectActionsMenu) return;

    const workspace = workspaceByProject[projectActionsMenu.projectId];
    const canStop = workspace
      ? ["running", "starting"].includes(workspace.status)
      : false;

    if (!workspace || !canStop) {
      setProjectActionsMenu(null);
      return;
    }

    setProjectActionsMenu(null);
    stopWorkspaceMutation.mutate(workspace.id);
  };

  const handleMenuDelete = () => {
    if (!projectActionsMenu) return;

    const project = projectsById[projectActionsMenu.projectId];
    if (!project) return;

    setProjectActionsMenu(null);
    setDeleteConfirmProjectId(project.id);
  };

  const handleConfirmDelete = () => {
    if (!deleteConfirmProjectId) return;
    deleteProjectMutation.mutate(deleteConfirmProjectId);
  };

  const canStopActionsWorkspace = (() => {
    if (!projectActionsMenu) return false;
    const workspace = workspaceByProject[projectActionsMenu.projectId];
    return workspace
      ? ["running", "starting"].includes(workspace.status)
      : false;
  })();

  const deleteConfirmProject = deleteConfirmProjectId
    ? projectsById[deleteConfirmProjectId]
    : undefined;

  return (
    <>
      <div className="mb-2.5 flex items-center justify-between px-1">
        <h2 className="text-xs font-medium text-muted-foreground">
          Continue Existing Project
        </h2>
        <button
          type="button"
          onClick={() => {}}
          className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          View all
        </button>
      </div>

      <div className="space-y-1">
        {isProjectsLoading ? (
          <div className="space-y-1">
            {[0, 1, 2, 3].map((item) => (
              <div key={item} className="flex items-center gap-1 px-1 py-1">
                <div className="flex min-w-0 flex-1 items-center justify-between rounded-md border border-border/50 px-2 py-1.5">
                  <div className="h-3.5 w-32 animate-pulse rounded bg-muted" />
                  <div className="h-5 w-36 animate-pulse rounded-md bg-muted" />
                </div>
                <div className="h-6 w-6 animate-pulse rounded-md bg-muted" />
              </div>
            ))}
          </div>
        ) : recentProjects.length === 0 ? (
          <div className="px-2 py-1.5 text-sm text-muted-foreground">
            No projects found. Create one to get started.
          </div>
        ) : (
          recentProjects.map(({ project, workspace }) => (
            <div
              key={project.id}
              onContextMenu={(event) => {
                event.preventDefault();
                if (editingProjectId === project.id) return;
                handleOpenProjectActionsMenu(
                  project,
                  event.clientX,
                  event.clientY,
                );
              }}
              onTouchStart={(event) => {
                if (editingProjectId === project.id) return;
                const touch = event.touches[0];
                if (!touch) return;

                clearLongPressTimer();
                longPressTimerRef.current = window.setTimeout(() => {
                  suppressQuickOpenUntilRef.current = Date.now() + 800;
                  handleOpenProjectActionsMenu(
                    project,
                    touch.clientX,
                    touch.clientY,
                  );
                }, 480);
              }}
              onTouchMove={clearLongPressTimer}
              onTouchEnd={clearLongPressTimer}
              onTouchCancel={clearLongPressTimer}
            >
              <ProjectRow
                project={project}
                workspace={workspace}
                isSelected={selectedProjectId === project.id}
                isEditing={editingProjectId === project.id}
                editingProjectName={editingProjectName}
                onEditingProjectNameChange={setEditingProjectName}
                onSaveEdit={handleSaveProjectName}
                onCancelEdit={handleCancelEditingProject}
                onStartEdit={handleStartEditingProject}
                onQuickContinue={onQuickContinue}
                quickContinuePending={quickContinuePending}
                shouldSuppressQuickOpen={() =>
                  Date.now() < suppressQuickOpenUntilRef.current
                }
                onOpenContinueConfig={onOpenContinueConfig}
                disableRename={disableActions}
                onOpenMenu={handleOpenProjectActionsMenu}
                continuePreset={continuePreset}
                onContinuePresetSelect={onContinuePresetSelect}
                showContinueCustomize={showContinueCustomize}
                onToggleContinueCustomize={onToggleContinueCustomize}
                continueInputs={continueInputs}
                continueErrors={continueErrors}
                onContinueInputChange={onContinueInputChange}
                continueResources={continueResources}
                onContinueCancel={onContinueCancel}
                onContinueSubmit={onContinueSubmit}
                continueSubmitting={continueSubmitting}
              />
            </div>
          ))
        )}
      </div>

      <ProjectActionsMenu
        isOpen={Boolean(projectActionsMenu)}
        x={projectActionsMenu?.x ?? 0}
        y={projectActionsMenu?.y ?? 0}
        menuRef={menuRef}
        canStopWorkspace={canStopActionsWorkspace}
        isRenamePending={updateProjectMutation.isPending}
        isStopPending={stopWorkspaceMutation.isPending}
        isDeletePending={deleteProjectMutation.isPending}
        onRename={handleMenuRename}
        onStop={handleMenuStop}
        onDelete={handleMenuDelete}
      />

      <AlertDialog
        open={Boolean(deleteConfirmProjectId)}
        onOpenChange={(open) => {
          if (!open && !deleteProjectMutation.isPending) {
            setDeleteConfirmProjectId(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete project?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirmProject
                ? `Delete "${deleteConfirmProject.name}" permanently.`
                : "Delete this project permanently."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => setDeleteConfirmProjectId(null)}
              disabled={deleteProjectMutation.isPending}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDelete}
              disabled={deleteProjectMutation.isPending}
            >
              {deleteProjectMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
