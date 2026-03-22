// ** import types
import type { Execution } from "@repo/db";

// ** import core packages
import {
  AlertCircle,
  ArrowUpRight,
  ExternalLink,
  Hammer,
  Play,
  Rocket,
  Square,
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

const PREVIEW_HOST = "localhost:3000";

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
      {!copy.canRenderPreview && (
        <div className="border-b border-border/30 px-4 py-4">
          <div
            className={[
              "flex items-start gap-3 rounded-2xl border px-4 py-4",
              copy.tone,
            ].join(" ")}
          >
            <Icon className="mt-0.5 size-4 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-3">
                <div className="text-sm font-medium text-foreground">
                  {copy.title}
                </div>
                <div className="shrink-0 rounded-full border border-border/40 bg-background/50 px-2.5 py-0.5 text-[10px] uppercase tracking-wider text-muted-foreground/70 shadow-sm">
                  {getWorkspaceStatusLabel(execution)}
                </div>
              </div>
              <div className="mt-1.5 text-xs leading-5 text-muted-foreground">
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
            <div className="flex h-11 shrink-0 items-center gap-3 border-b border-border/30 bg-gradient-to-b from-card/35 to-card/10 px-4">
              <div className="flex gap-1.5">
                <div className="size-2.5 rounded-full bg-[#ff5f57]/80" />
                <div className="size-2.5 rounded-full bg-[#febc2e]/80" />
                <div className="size-2.5 rounded-full bg-[#28c840]/80" />
              </div>
              <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex h-7 min-w-0 flex-1 items-center rounded-full border border-border/40 bg-background/70 px-3 shadow-sm backdrop-blur">
                  <Globe className="mr-2 size-3 shrink-0 text-muted-foreground/50" />
                  <span className="truncate text-xs text-muted-foreground/70">
                    {PREVIEW_HOST}
                  </span>
                </div>
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
          <div className="flex h-full items-center justify-center bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.05),transparent_48%)] p-6 text-center">
            <div className="flex max-w-md flex-col items-center gap-4 rounded-3xl border border-border/40 bg-card/20 px-6 py-7 text-muted-foreground shadow-[0_20px_80px_rgba(0,0,0,0.18)] backdrop-blur-sm">
              <div className="flex size-12 items-center justify-center rounded-2xl border border-border/40 bg-background/70">
                <LayoutTemplate className="size-6 opacity-40" />
              </div>
              <div>
                <div className="text-sm font-medium text-foreground">
                  Preview not available yet
                </div>
                <div className="mt-2 text-sm leading-6">
                  Open `Review` to inspect output, `Timeline` to trace the run,
                  or `Code` to browse generated sources.
                </div>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                <Button size="sm" variant="secondary" onClick={onOpenReview}>
                  <ArrowUpRight className="size-3.5" /> Review
                </Button>
                <Button size="sm" variant="ghost" onClick={onOpenCode}>
                  <ExternalLink className="size-3.5" /> Code
                </Button>
              </div>
              <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground/50">
                {copy.title}
              </div>
              <div className="text-xs leading-5 text-muted-foreground/80">
                {copy.description}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
