// ** import types
import type { Execution } from "@repo/db";

// ** import core packages
import {
  AlertCircle,
  ExternalLink,
  Hammer,
  Play,
  Rocket,
  Square,
  RefreshCcw,
  LayoutTemplate,
  Globe,
} from "lucide-react";

// ** import components
import { Button } from "@/components/ui/button";

// ** import utils
import {
  getWorkspaceStatusLabel,
  type WorkspaceSource,
} from "./workspace-types";

type PreviewState =
  | "building"
  | "preview_available"
  | "no_preview_artifact"
  | "runtime_stopped"
  | "manual_run_required"
  | "cancelled_before_preview";

function getPreviewState({
  execution,
  workspaceSource,
  previewSource,
  hasPreviewArtifact,
}: {
  execution: Execution | null;
  workspaceSource: WorkspaceSource;
  previewSource: string | null;
  hasPreviewArtifact: boolean;
}): PreviewState {
  if (!execution) {
    return workspaceSource === "main"
      ? "manual_run_required"
      : "no_preview_artifact";
  }

  if (previewSource) {
    if (execution.status === "completed" || execution.status === "failed") {
      return "runtime_stopped";
    }

    return "preview_available";
  }

  if (execution.status === "queued" || execution.status === "running") {
    return "building";
  }

  if (execution.status === "cancelled") {
    return "cancelled_before_preview";
  }

  if (workspaceSource === "main") {
    return "manual_run_required";
  }

  if (hasPreviewArtifact) {
    return "runtime_stopped";
  }

  return "no_preview_artifact";
}

const PREVIEW_COPY: Record<
  PreviewState,
  {
    title: string;
    description: string;
    icon: typeof Hammer;
    tone: string;
    canRenderPreview: boolean;
  }
> = {
  building: {
    title: "Preparing preview artifacts",
    description:
      "The run is still building. Timeline shows live agent events while the app surface is generated.",
    icon: Hammer,
    tone: "text-vibe-warning border-vibe-warning/20 bg-vibe-warning/8",
    canRenderPreview: false,
  },
  preview_available: {
    title: "Preview available",
    description:
      "This run produced an artifact preview. Review changes or switch to Code for the underlying files.",
    icon: Rocket,
    tone: "text-vibe-success border-vibe-success/20 bg-vibe-success/8",
    canRenderPreview: true,
  },
  no_preview_artifact: {
    title: "No preview artifact",
    description:
      "This run changed files, but did not emit a browsable app artifact. Use Review or Code to inspect the output.",
    icon: AlertCircle,
    tone: "text-muted-foreground border-border/40 bg-card/30",
    canRenderPreview: false,
  },
  runtime_stopped: {
    title: "Preview snapshot only",
    description:
      "The workspace has a static preview artifact, but the runtime is no longer live. Re-run if you need a fresh app session.",
    icon: Square,
    tone: "text-muted-foreground border-border/40 bg-card/30",
    canRenderPreview: true,
  },
  manual_run_required: {
    title: "Manual run required",
    description:
      "Main source is selected without a current preview artifact. Start a run to generate a fresh app surface.",
    icon: Play,
    tone: "text-primary border-primary/20 bg-primary/8",
    canRenderPreview: false,
  },
  cancelled_before_preview: {
    title: "Cancelled before preview",
    description:
      "This run stopped before producing a preview. Timeline and Details still preserve what happened.",
    icon: Square,
    tone: "text-muted-foreground border-border/40 bg-card/30",
    canRenderPreview: false,
  },
};

export function WorkspaceAppPreview({
  execution,
  workspaceSource,
  previewSource,
  hasPreviewArtifact,
  onOpenCode,
  onOpenReview,
  onRun,
}: {
  execution: Execution | null;
  workspaceSource: WorkspaceSource;
  previewSource: string | null;
  hasPreviewArtifact: boolean;
  onOpenCode: () => void;
  onOpenReview: () => void;
  onRun: () => void;
}) {
  const state = getPreviewState({
    execution,
    workspaceSource,
    previewSource,
    hasPreviewArtifact,
  });
  const copy = PREVIEW_COPY[state];
  const Icon = copy.icon;

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex items-center justify-between border-b border-border/40 bg-card/10 px-4 py-3">
        <div className="min-w-0">
          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground/50">
            App Surface
          </div>
          <div className="mt-1 text-sm font-medium text-foreground/88">
            {execution?.taskDescription ||
              execution?.prompt ||
              "Workspace preview"}
          </div>
        </div>
        <div className="ml-4 shrink-0 rounded-full border border-border/40 bg-background/50 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 shadow-sm">
          {getWorkspaceStatusLabel(execution)}
        </div>
      </div>

      {!copy.canRenderPreview && (
        <div className="border-b border-border/30 px-4 py-3">
          <div
            className={[
              "flex items-start gap-3 rounded-xl border px-3.5 py-3",
              copy.tone,
            ].join(" ")}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium text-foreground">
                {copy.title}
              </div>
              <div className="mt-1 text-xs leading-5 text-muted-foreground">
                {copy.description}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {(state === "manual_run_required" ||
                  state === "cancelled_before_preview") && (
                  <Button size="sm" variant="secondary" onClick={onRun}>
                    <Play className="size-3.5" /> Run again
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={onOpenReview}>
                  <ExternalLink className="size-3.5" /> Review
                </Button>
                <Button size="sm" variant="ghost" onClick={onOpenCode}>
                  <ExternalLink className="size-3.5" /> Code
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 bg-background flex flex-col p-0">
        {copy.canRenderPreview && previewSource ? (
          <>
            <div className="flex h-9 shrink-0 items-center gap-2 border-b border-border/30 bg-muted/20 px-3">
              <div className="flex gap-1.5 px-1 opacity-40">
                <div className="size-2.5 rounded-full bg-foreground/20" />
                <div className="size-2.5 rounded-full bg-foreground/20" />
                <div className="size-2.5 rounded-full bg-foreground/20" />
              </div>
              <div className="ml-2 flex h-6 flex-1 items-center justify-center rounded-md bg-background px-3 border border-border/40 shadow-sm transition-colors text-xs text-muted-foreground/50 max-w-sm cursor-not-allowed">
                <Globe className="mr-2 size-3 opacity-50" />
                localhost:3000
              </div>
            </div>
            <div className="h-full overflow-hidden bg-background">
              <iframe
                title="App preview"
                sandbox="allow-scripts"
                srcDoc={previewSource}
                className="h-full w-full bg-background border-none"
              />
            </div>
          </>
        ) : (
          <div className="flex h-full items-center justify-center p-6 text-center">
            <div className="flex flex-col items-center gap-4 text-muted-foreground">
              <div className="flex size-12 items-center justify-center rounded-full bg-muted/30">
                <LayoutTemplate className="size-6 opacity-40" />
              </div>
              <div className="max-w-md text-sm">
                Open `Review` to inspect file output, `Timeline` to trace the
                run, or `Code` to browse generated sources.
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
