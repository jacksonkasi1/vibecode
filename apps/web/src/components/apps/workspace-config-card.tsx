// ** import types
import type {
  ResourceErrors,
  ResourceInputs,
  ResourceKey,
  WorkspacePreset,
  WorkspaceResources,
} from "@/lib/workspace-config";

// ** import core packages
import { Cpu, HardDrive } from "lucide-react";

// ** import utils
import { presetCards } from "@/lib/workspace-config";

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
        <label key={key} className="text-xs text-muted-foreground">
          {label}
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={inputs[key]}
            onChange={(event) => onInputChange(key, event.target.value)}
            className="mt-1 h-7 w-full rounded-md border border-border/60 bg-background px-2 text-xs text-foreground"
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

export function WorkspaceConfigCard({
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
      {title ? <h3 className="mb-2 text-xs font-medium">{title}</h3> : null}

      <p className="mb-2 text-xs text-muted-foreground">Workspace preset</p>
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
            <div className="text-xs font-medium">{label}</div>
            <div className="text-[10px]">{summary}</div>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={onToggleCustomize}
        className="mt-2 text-xs text-muted-foreground hover:text-foreground"
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
        <div className="inline-flex items-center gap-2 text-xs text-muted-foreground">
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
            className="rounded-md border border-border/60 px-2.5 py-1 text-xs text-muted-foreground hover:bg-secondary/60 hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onSubmit}
            disabled={isSubmitting}
            className="rounded-md bg-foreground px-2.5 py-1 text-xs text-background disabled:opacity-60"
          >
            {isSubmitting ? submittingLabel : submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
