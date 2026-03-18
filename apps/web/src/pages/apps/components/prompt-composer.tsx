// ** import types
import type { ModelConfig } from "@repo/db";
import type { LucideIcon } from "lucide-react";

// ** import core packages
import {
  ArrowUp,
  Compass,
  Infinity,
  Paperclip,
  Plus,
  Settings,
} from "lucide-react";

// ** import components
import { Panel } from "@/components/vibe-ui";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type PromptComposerProps = {
  prompt: string;
  onPromptChange: (value: string) => void;
  onPromptSubmit: () => void;
  isPromptSubmitting: boolean;
  selectedMode: "Agent" | "Plan";
  selectedModeIcon: LucideIcon;
  modeOptions: readonly ["Agent", "Plan"];
  onSelectMode: (mode: "Agent" | "Plan") => void;
  selectedModelName: string;
  models: ModelConfig[];
  isModelsLoading: boolean;
  onSelectModel: (modelId: string) => void;
  isCreateConfigOpen: boolean;
  onToggleCreateConfig: () => void;
  onCreateBlankProject: () => void;
  isCreatingBlankProject: boolean;
};

export function PromptComposer({
  prompt,
  onPromptChange,
  onPromptSubmit,
  isPromptSubmitting,
  selectedMode,
  selectedModeIcon: SelectedModeIcon,
  modeOptions,
  onSelectMode,
  selectedModelName,
  models,
  isModelsLoading,
  onSelectModel,
  isCreateConfigOpen,
  onToggleCreateConfig,
  onCreateBlankProject,
  isCreatingBlankProject,
}: PromptComposerProps) {
  return (
    <>
      <Panel className="mb-3 border-0 bg-transparent">
        <div className="rounded-lg border border-border bg-card p-1.5 shadow-sm transition-all focus-within:border-ring/40 focus-within:ring-1 focus-within:ring-ring/20">
          <textarea
            value={prompt}
            onChange={(event) => onPromptChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                onPromptSubmit();
              }
            }}
            placeholder="Enter the prompt"
            className="max-h-28 min-h-14 w-full resize-none bg-transparent px-2 pt-1 text-sm leading-5 placeholder:text-muted-foreground focus:outline-none"
            disabled={isPromptSubmitting}
          />
          <div className="mt-1 flex items-center justify-between gap-2 px-1 pb-0.5">
            <div className="flex items-center gap-1">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-md border border-border/50 bg-background/50 px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <SelectedModeIcon className="size-3" />
                    {selectedMode}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-32 text-xs">
                  {modeOptions.map((option) => (
                    <DropdownMenuItem
                      className="px-2 py-1 text-xs"
                      key={option}
                      onClick={() => onSelectMode(option)}
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
                    className="inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-md border border-border/50 bg-background/50 px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    ✦ {selectedModelName}
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="w-56 text-xs">
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
                    <DropdownMenuItem className="px-2 py-1 text-xs" disabled>
                      No models available
                    </DropdownMenuItem>
                  ) : (
                    models.map((model) => (
                      <DropdownMenuItem
                        className="px-2 py-1 text-xs"
                        key={model.id}
                        onClick={() => onSelectModel(model.id)}
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
                onClick={onToggleCreateConfig}
                className={[
                  "inline-flex h-6 w-6 items-center justify-center rounded-md border border-border/50 bg-background/50 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                  isCreateConfigOpen ? "bg-secondary text-foreground" : "",
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
                onClick={onPromptSubmit}
                disabled={isPromptSubmitting || !prompt.trim()}
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
          onClick={onCreateBlankProject}
          disabled={isCreatingBlankProject}
          className="cursor-pointer rounded-md border border-border/50 bg-background/50 px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isCreatingBlankProject ? "Launching..." : "Create Blank Project"}
        </button>
      </div>
    </>
  );
}
