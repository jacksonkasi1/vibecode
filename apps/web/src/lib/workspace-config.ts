// ** import types
import type { Workspace } from "@repo/db";

export type WorkspacePreset = "small" | "medium" | "large" | "custom";
export type ResourceKey = "cpu" | "ram" | "storage";

export type WorkspaceResources = {
  cpu: number;
  ram: number;
  storage: number;
};

export type WorkspaceMetadata = {
  preset?: WorkspacePreset;
  modelId?: string;
  location?: "cloud" | "local";
  resources?: WorkspaceResources;
};

export type ResourceInputs = Record<ResourceKey, string>;
export type ResourceErrors = Partial<Record<ResourceKey, string>>;

export const resourceMins: Record<ResourceKey, number> = {
  cpu: 1,
  ram: 1,
  storage: 5,
};

export const presetValues: Record<
  Exclude<WorkspacePreset, "custom">,
  WorkspaceResources
> = {
  small: { cpu: 2, ram: 4, storage: 10 },
  medium: { cpu: 4, ram: 8, storage: 20 },
  large: { cpu: 8, ram: 16, storage: 50 },
};

export const presetCards = [
  ["small", "Small", "2 vCPU, 4GB, 10GB"],
  ["medium", "Medium", "4 vCPU, 8GB, 20GB"],
  ["large", "Large", "8 vCPU, 16GB, 50GB"],
  ["custom", "Custom", "Adjust"],
] as const;

export const defaultResources = presetValues.medium;

export function parseWorkspaceMetadata(
  metadata: string | null,
): WorkspaceMetadata {
  if (!metadata) return {};

  try {
    return JSON.parse(metadata) as WorkspaceMetadata;
  } catch {
    return {};
  }
}

export function resourcesToInputs(
  resources: WorkspaceResources,
): ResourceInputs {
  return {
    cpu: String(resources.cpu),
    ram: String(resources.ram),
    storage: String(resources.storage),
  };
}

export function resourcesFromWorkspace(
  workspace?: Workspace,
): WorkspaceResources {
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

export function presetFromResources(
  resources: WorkspaceResources,
): WorkspacePreset {
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

export function parseNumeric(value: string): number | null {
  if (!/^[0-9]+$/.test(value)) return null;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return null;

  return parsed;
}

export function validateResourceInputs(inputs: ResourceInputs): ResourceErrors {
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

export function hasErrors(errors: ResourceErrors): boolean {
  return Boolean(errors.cpu || errors.ram || errors.storage);
}

export function parseWithMin(value: string, key: ResourceKey): number {
  const parsed = parseNumeric(value);
  if (parsed === null) return resourceMins[key];
  return Math.max(parsed, resourceMins[key]);
}

export function presetLabel(preset: WorkspacePreset): string {
  if (preset === "small") return "Small";
  if (preset === "medium") return "Medium";
  if (preset === "large") return "Large";
  return "Custom";
}

export function presetShortLabel(preset: WorkspacePreset): string {
  if (preset === "small") return "S";
  if (preset === "medium") return "M";
  if (preset === "large") return "L";
  return "C";
}
