// ** import types
import type { Project, Workspace } from "@repo/db";
import type {
  ResourceInputs,
  ResourceKey,
  WorkspacePreset,
  WorkspaceResources,
} from "@/lib/workspace-config";

// ** import core packages
import { useMemo, useState } from "react";
import { toast } from "sonner";

// ** import utils
import {
  defaultResources,
  hasErrors,
  parseNumeric,
  parseWithMin,
  presetFromResources,
  presetValues,
  resourceMins,
  resourcesFromWorkspace,
  resourcesToInputs,
  validateResourceInputs,
} from "@/lib/workspace-config";

export function useWorkspaceConfig(
  latestWorkspaceByProject: Record<string, Workspace>,
) {
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

  return {
    isCreateConfigOpen,
    setIsCreateConfigOpen,
    createPreset,
    createResources,
    createInputs,
    showCreateCustomize,
    setShowCreateCustomize,
    createErrors,
    handleCreatePreset,
    handleCreateInputChange,
    syncCreateResourcesFromInputs,
    selectedProjectId,
    setSelectedProjectId,
    continuePreset,
    continueResources,
    continueInputs,
    showContinueCustomize,
    setShowContinueCustomize,
    continueErrors,
    handleContinuePreset,
    handleContinueInputChange,
    syncContinueResourcesFromInputs,
    handleOpenContinueConfig,
  };
}
