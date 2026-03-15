// ** import types
import type { Project, Workspace } from "@repo/db";
import type {
  ResourceErrors,
  ResourceInputs,
  ResourceKey,
  WorkspacePreset,
  WorkspaceResources,
} from "@/lib/workspace-config";

// ** import core packages
import { Cloud, CloudOff, Cpu, Loader2, Pencil, Settings } from "lucide-react";

// ** import utils
import {
  parseWorkspaceMetadata,
  presetFromResources,
  presetLabel,
  presetShortLabel,
  resourcesFromWorkspace,
} from "@/lib/workspace-config";

// ** import components
import { WorkspaceConfigCard } from "@/components/apps/workspace-config-card";

type ProjectRowProps = {
  project: Project;
  workspace?: Workspace;
  isSelected: boolean;
  isEditing: boolean;
  editingProjectName: string;
  onEditingProjectNameChange: (value: string) => void;
  onSaveEdit: (project: Project) => void;
  onCancelEdit: () => void;
  onStartEdit: (project: Project) => void;
  onQuickContinue: (projectId: string) => void;
  quickContinuePending: boolean;
  shouldSuppressQuickOpen: () => boolean;
  onOpenContinueConfig: (project: Project) => void;
  disableRename: boolean;
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

export function ProjectRow({
  project,
  workspace,
  isSelected,
  isEditing,
  editingProjectName,
  onEditingProjectNameChange,
  onSaveEdit,
  onCancelEdit,
  onStartEdit,
  onQuickContinue,
  quickContinuePending,
  shouldSuppressQuickOpen,
  onOpenContinueConfig,
  disableRename,
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
}: ProjectRowProps) {
  const isOnline = workspace
    ? ["running", "starting"].includes(workspace.status)
    : false;
  const metadata = parseWorkspaceMetadata(workspace?.metadata ?? null);
  const selectedResources =
    metadata.resources ?? resourcesFromWorkspace(workspace);
  const selectedPreset =
    metadata.preset ?? presetFromResources(selectedResources);

  return (
    <div>
      <div className="group flex items-center gap-1 px-1 py-1">
        {isEditing ? (
          <div className="flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px]">
            <div className="min-w-0 flex flex-1 items-center gap-1.5">
              <input
                autoFocus
                value={editingProjectName}
                onChange={(event) =>
                  onEditingProjectNameChange(event.target.value)
                }
                onBlur={() => onSaveEdit(project)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    onSaveEdit(project);
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    onCancelEdit();
                  }
                }}
                className="min-w-0 flex-1 bg-transparent p-0 font-medium text-foreground/90 outline-none"
              />
              {disableRename ? (
                <Loader2 className="h-3 w-3 shrink-0 animate-spin text-muted-foreground" />
              ) : null}
            </div>
            <ProjectStatusMeta
              isOnline={isOnline}
              selectedPreset={selectedPreset}
              selectedResources={selectedResources}
            />
          </div>
        ) : (
          <div
            role="button"
            tabIndex={0}
            onClick={() => {
              if (shouldSuppressQuickOpen()) return;
              if (quickContinuePending) return;
              onQuickContinue(project.id);
            }}
            onKeyDown={(event) => {
              if (event.key !== "Enter" && event.key !== " ") return;
              event.preventDefault();
              if (quickContinuePending) return;
              onQuickContinue(project.id);
            }}
            className={[
              "flex min-w-0 flex-1 items-center justify-between rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-secondary/50",
              quickContinuePending
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
                  onStartEdit(project);
                }}
                disabled={disableRename}
                className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-sm text-muted-foreground transition-all hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60 opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                aria-label={`Rename ${project.name}`}
              >
                <Pencil className="h-3 w-3" />
              </button>
            </div>
            <ProjectStatusMeta
              isOnline={isOnline}
              selectedPreset={selectedPreset}
              selectedResources={selectedResources}
            />
          </div>
        )}

        <button
          type="button"
          onClick={() => onOpenContinueConfig(project)}
          className={[
            "inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            isSelected ? "bg-secondary text-foreground" : "",
          ].join(" ")}
          aria-label={`Configure ${project.name}`}
        >
          <Settings className="h-3 w-3" />
        </button>
      </div>

      {isSelected ? (
        <WorkspaceConfigCard
          title="Continue Project"
          className="mb-6 mt-1 rounded-lg border border-border bg-card p-3"
          preset={continuePreset}
          onPresetSelect={onContinuePresetSelect}
          showCustomize={showContinueCustomize}
          onToggleCustomize={onToggleContinueCustomize}
          inputs={continueInputs}
          errors={continueErrors}
          onInputChange={onContinueInputChange}
          resources={continueResources}
          onCancel={onContinueCancel}
          onSubmit={onContinueSubmit}
          submitLabel="Continue Project"
          submittingLabel="Opening..."
          isSubmitting={continueSubmitting}
        />
      ) : null}
    </div>
  );
}

function ProjectStatusMeta({
  isOnline,
  selectedPreset,
  selectedResources,
}: {
  isOnline: boolean;
  selectedPreset: WorkspacePreset;
  selectedResources: WorkspaceResources;
}) {
  return (
    <span
      className={[
        "ml-3 inline-flex shrink-0 items-center gap-2 text-[11px]",
        isOnline ? "text-emerald-600" : "text-muted-foreground",
      ].join(" ")}
    >
      <span className="inline-flex items-center gap-1.5 rounded-md border border-border/50 px-1.5 py-0.5 text-muted-foreground">
        <Cpu className="h-3 w-3" />
        <span className="hidden lg:inline">
          {presetLabel(selectedPreset)} {selectedResources.cpu}
          CPU {selectedResources.ram}G {selectedResources.storage}G
        </span>
        <span className="lg:hidden">
          {presetShortLabel(selectedPreset)} {selectedResources.cpu}/
          {selectedResources.ram}/{selectedResources.storage}
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
        <span className="lg:hidden">{isOnline ? "On" : "Off"}</span>
      </span>
    </span>
  );
}
