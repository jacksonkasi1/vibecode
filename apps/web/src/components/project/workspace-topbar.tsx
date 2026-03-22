// ** import types
import type { Execution } from "@repo/db";
import type { WorkspaceMode, WorkspaceSource } from "./workspace-types";

// ** import core packages
import {
  Globe,
  Loader2,
  PanelLeft,
  PanelRight,
  Terminal,
  ExternalLink,
} from "lucide-react";

// ** import components
import { Button } from "@/components/ui/button";
import { WorkspaceModeTabs } from "./workspace-mode-tabs";
import { WorkspaceSourceSelector } from "./workspace-source-selector";

// ** import utils
import {
  getWorkspaceStatusLabel,
  type WorkspaceSource as SourceOption,
} from "./workspace-types";

export function WorkspaceTopbar({
  execution,
  workspaceMode,
  workspaceSource,
  sourceOptions,
  isAssistantPanelOpen,
  isInspectorOpen,
  isTerminalOpen,
  liveDir,
  onWorkspaceModeChange,
  onWorkspaceSourceChange,
  onToggleAssistant,
  onToggleInspector,
  onToggleTerminal,
}: {
  execution: Execution | null;
  workspaceMode: WorkspaceMode;
  workspaceSource: WorkspaceSource;
  sourceOptions: SourceOption[];
  isAssistantPanelOpen: boolean;
  isInspectorOpen: boolean;
  isTerminalOpen: boolean;
  /** Filesystem path to open in VSCode. When provided, shows the "Open in VSCode" button. */
  liveDir?: string;
  onWorkspaceModeChange: (value: WorkspaceMode) => void;
  onWorkspaceSourceChange: (value: WorkspaceSource) => void;
  onToggleAssistant: () => void;
  onToggleInspector: () => void;
  onToggleTerminal: () => void;
}) {
  const isRunning =
    execution?.status === "running" || execution?.status === "queued";

  return (
    <header className="flex h-10 shrink-0 items-center justify-between border-b border-border/30 bg-card/20 px-2.5">
      <div className="flex flex-1 items-center gap-1.5">
        <button
          type="button"
          onClick={onToggleAssistant}
          className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/35 hover:text-foreground"
          title="Toggle Assistant"
        >
          <PanelLeft
            className={`size-4 ${isAssistantPanelOpen ? "text-primary" : ""}`}
          />
        </button>
        <div className="mx-1 h-4 w-px bg-border/30" />
        <WorkspaceSourceSelector
          value={workspaceSource}
          options={sourceOptions}
          onChange={onWorkspaceSourceChange}
        />
      </div>

      <div className="flex flex-1 items-center justify-center">
        <WorkspaceModeTabs
          value={workspaceMode}
          onChange={onWorkspaceModeChange}
        />
      </div>

      <div className="flex flex-1 items-center justify-end gap-1.5">
        <span className="rounded-full border border-border/40 bg-muted/20 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70 shadow-sm">
          {getWorkspaceStatusLabel(execution)}
        </span>

        {isRunning ? (
          <span
            role="status"
            aria-live="polite"
            className="mr-1 flex items-center gap-1 rounded-full border border-blue-500/30 bg-blue-500/10 px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-wider text-blue-400 shadow-sm"
          >
            <Loader2
              className="size-3 motion-safe:animate-spin"
              aria-hidden="true"
            />{" "}
            Running
          </span>
        ) : null}

        {liveDir ? (
          <a
            href={`vscode://file/${liveDir.split("/").map(encodeURIComponent).join("/")}`}
            title="Open workspace in VSCode"
            rel="noopener noreferrer"
            className="inline-flex h-7 items-center gap-1.5 rounded-md border border-border/60 bg-muted/30 px-2.5 text-[11px] font-medium text-foreground/80 transition-colors hover:border-border hover:bg-secondary/60 hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <ExternalLink className="size-3.5" aria-hidden="true" />
            Open in VSCode
          </a>
        ) : null}

        <Button size="sm" variant="secondary" className="h-7 px-2.5">
          <Globe className="size-3.5" /> Deploy
        </Button>
        <button
          type="button"
          onClick={onToggleTerminal}
          aria-label={isTerminalOpen ? "Hide terminal" : "Show terminal"}
          aria-pressed={isTerminalOpen}
          className={[
            "flex size-7 items-center justify-center rounded-md transition-colors",
            isTerminalOpen
              ? "bg-primary/12 text-primary"
              : "text-muted-foreground hover:bg-secondary/35 hover:text-foreground",
          ].join(" ")}
          title={isTerminalOpen ? "Hide Terminal" : "Show Terminal"}
        >
          <Terminal className="size-4" />
        </button>
        {["details", "review"].includes(workspaceMode) ? (
          <>
            <div className="mx-1 h-4 w-px bg-border/30" />
            <button
              type="button"
              onClick={onToggleInspector}
              className="flex size-7 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/35 hover:text-foreground"
              title="Toggle Inspector"
            >
              <PanelRight
                className={`size-4 ${isInspectorOpen ? "text-primary" : ""}`}
              />
            </button>
          </>
        ) : null}
      </div>
    </header>
  );
}
