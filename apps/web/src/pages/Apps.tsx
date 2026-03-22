// ** import types
import type { AppsMode } from "@/pages/apps/types";

// ** import core packages
import { Compass, Infinity as InfinityIcon } from "lucide-react";
import { useState } from "react";

// ** import components
import { WorkspaceConfigCard } from "@/components/apps/workspace-config-card";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { AppShellHeader } from "@/components/header/app-shell-header";
import { VibeMark } from "@/components/vibe-ui";
import { ContinueProjectsSection } from "@/pages/apps/components/continue-projects-section";
import { PromptComposer } from "@/pages/apps/components/prompt-composer";

// ** import utils
import { useAppsActions } from "@/pages/apps/hooks/use-apps-actions";
import { useAppsData } from "@/pages/apps/hooks/use-apps-data";
import { useWorkspaceConfig } from "@/pages/apps/hooks/use-workspace-config";

const modeOptions = ["Agent", "Plan"] as const;
const modeIcons = {
  Agent: InfinityIcon,
  Plan: Compass,
} as const;

export default function Apps() {
  const [selectedMode, setSelectedMode] = useState<AppsMode>("Agent");

  const {
    models,
    isModelsLoading,
    selectedModelId,
    setSelectedModelId,
    selectedModelName,
    isProjectsLoading,
    latestWorkspaceByProject,
    recentProjects,
  } = useAppsData();

  const workspaceConfig = useWorkspaceConfig(latestWorkspaceByProject);

  const {
    prompt,
    setPrompt,
    createProjectMutation,
    quickContinueMutation,
    continueProjectMutation,
    executePromptMutation,
    handlePromptSubmit,
  } = useAppsActions({
    selectedModelId,
    createPreset: workspaceConfig.createPreset,
    createResources: workspaceConfig.createResources,
    selectedProjectId: workspaceConfig.selectedProjectId,
    continuePreset: workspaceConfig.continuePreset,
    continueResources: workspaceConfig.continueResources,
    latestWorkspaceByProject,
  });

  const SelectedModeIcon = modeIcons[selectedMode];

  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-8 pt-5 sm:px-6">
          <AppShellHeader />

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
              isCreateConfigOpen={workspaceConfig.isCreateConfigOpen}
              onToggleCreateConfig={() =>
                workspaceConfig.setIsCreateConfigOpen((prev) => !prev)
              }
              onCreateBlankProject={() => createProjectMutation.mutate()}
              isCreatingBlankProject={createProjectMutation.isPending}
            />

            {workspaceConfig.isCreateConfigOpen ? (
              <WorkspaceConfigCard
                className="mb-6 rounded-lg border border-border bg-card p-3"
                preset={workspaceConfig.createPreset}
                onPresetSelect={workspaceConfig.handleCreatePreset}
                showCustomize={workspaceConfig.showCreateCustomize}
                onToggleCustomize={() =>
                  workspaceConfig.setShowCreateCustomize((prev) => !prev)
                }
                inputs={workspaceConfig.createInputs}
                errors={workspaceConfig.createErrors}
                onInputChange={workspaceConfig.handleCreateInputChange}
                resources={workspaceConfig.createResources}
                onCancel={() => workspaceConfig.setIsCreateConfigOpen(false)}
                onSubmit={() => {
                  if (
                    workspaceConfig.showCreateCustomize ||
                    workspaceConfig.createPreset === "custom"
                  ) {
                    if (!workspaceConfig.syncCreateResourcesFromInputs())
                      return;
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
              selectedProjectId={workspaceConfig.selectedProjectId}
              onOpenContinueConfig={workspaceConfig.handleOpenContinueConfig}
              quickContinuePending={quickContinueMutation.isPending}
              onQuickContinue={(projectId) =>
                quickContinueMutation.mutate(projectId)
              }
              continuePreset={workspaceConfig.continuePreset}
              onContinuePresetSelect={workspaceConfig.handleContinuePreset}
              showContinueCustomize={workspaceConfig.showContinueCustomize}
              onToggleContinueCustomize={() =>
                workspaceConfig.setShowContinueCustomize((prev) => !prev)
              }
              continueInputs={workspaceConfig.continueInputs}
              continueErrors={workspaceConfig.continueErrors}
              onContinueInputChange={workspaceConfig.handleContinueInputChange}
              continueResources={workspaceConfig.continueResources}
              onContinueCancel={() =>
                workspaceConfig.setSelectedProjectId(null)
              }
              onContinueSubmit={() => {
                if (
                  workspaceConfig.showContinueCustomize ||
                  workspaceConfig.continuePreset === "custom"
                ) {
                  if (!workspaceConfig.syncContinueResourcesFromInputs())
                    return;
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
