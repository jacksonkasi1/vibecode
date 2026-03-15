// ** import lib
import {
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Globe,
  Github,
  Monitor,
  MoreHorizontal,
  PanelLeft,
  Pencil,
  Plus,
  RotateCw,
  UserPlus,
} from "lucide-react";
import { useState, type KeyboardEvent } from "react";
import { Link, useParams } from "react-router-dom";

// ** import components
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { VibeAssistantThread } from "@/components/assistant/vibe-assistant-thread";
import { ModeToggle } from "@/components/ui/mode-toggle";

const files = [
  ".vibe",
  "vibe-clone",
  "  node_modules",
  "  public",
  "  src",
  "    App.tsx",
  "    index.css",
  "    main.tsx",
  "  tailwind.config.js",
];

const editorCode = [
  "function Features() {",
  "  return (",
  '    <section className="py-24 px-4 bg-secondary/5">',
  '      <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">',
  "        {/* cards */}",
  "      </div>",
  "    </section>",
  "  )",
  "}",
];

export default function Project() {
  const params = useParams();
  const projectId = params.id ?? "1";
  const [isAssistantPanelOpen, setIsAssistantPanelOpen] = useState(true);
  const [projectName, setProjectName] = useState(`Project #${projectId}`);
  const [isEditingProjectName, setIsEditingProjectName] = useState(false);

  const finishProjectNameEdit = () => {
    const trimmed = projectName.trim();
    setProjectName(trimmed.length > 0 ? trimmed : `Project #${projectId}`);
    setIsEditingProjectName(false);
  };

  const handleProjectNameKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      finishProjectNameEdit();
      return;
    }

    if (event.key === "Escape") {
      setProjectName((prev) => prev.trim() || `Project #${projectId}`);
      setIsEditingProjectName(false);
    }
  };

  return (
    <ProtectedRoute>
      <div className="h-[100dvh] overflow-hidden bg-background text-foreground">
        <div className="flex h-full">
          <aside
            className={[
              "hidden h-full shrink-0 flex-col overflow-hidden bg-[hsl(var(--vibe-panel-2))] transition-[width,min-width,opacity,border-color] duration-200 ease-out md:flex",
              isAssistantPanelOpen
                ? "w-[376px] min-w-[376px] border-r border-border opacity-100"
                : "w-0 min-w-0 border-r border-transparent opacity-0 pointer-events-none",
            ].join(" ")}
            aria-hidden={!isAssistantPanelOpen}
          >
            <div
              className={[
                "flex h-10 shrink-0 w-[376px] items-center justify-between border-b bg-[hsl(var(--vibe-panel-2))] px-2 transition-opacity duration-150",
                isAssistantPanelOpen
                  ? "border-border opacity-100"
                  : "border-transparent opacity-0",
              ].join(" ")}
            >
              <div className="flex items-center gap-1.5">
                <Link
                  to="/apps"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </Link>
                {isEditingProjectName ? (
                  <input
                    value={projectName}
                    onChange={(event) => setProjectName(event.target.value)}
                    onBlur={finishProjectNameEdit}
                    onKeyDown={handleProjectNameKeyDown}
                    maxLength={40}
                    autoFocus
                    className="h-6 w-36 rounded-sm border border-border bg-background px-1.5 text-xs font-medium text-foreground outline-none"
                    aria-label="Edit project name"
                  />
                ) : (
                  <div className="flex items-center gap-1">
                    <span className="max-w-[132px] truncate text-xs font-medium">
                      {projectName}
                    </span>
                    <button
                      type="button"
                      onClick={() => setIsEditingProjectName(true)}
                      className="inline-flex h-5 w-5 items-center justify-center rounded-sm text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                      aria-label="Edit project name"
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  </div>
                )}
              </div>
              <ModeToggle />
            </div>

            <div className="w-[376px] flex-1">
              <VibeAssistantThread />
            </div>
          </aside>

          <section className="relative flex h-full min-w-0 flex-1 flex-col bg-[hsl(var(--vibe-workspace))]">
            <div className="flex h-10 items-center justify-between border-b border-border bg-[hsl(var(--vibe-panel-2))] px-2">
              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setIsAssistantPanelOpen((prev) => !prev)}
                  className="mr-1 inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                  aria-label={
                    isAssistantPanelOpen
                      ? "Close assistant panel"
                      : "Open assistant panel"
                  }
                >
                  <PanelLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-7 items-center justify-center rounded-md bg-secondary/80 px-2.5 text-xs font-medium text-foreground transition-colors"
                >
                  App
                </button>
                <button
                  type="button"
                  className="inline-flex h-7 items-center justify-center rounded-md px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  Code
                </button>
                <div className="mx-1 h-3.5 w-px bg-border"></div>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="flex items-center gap-0.5">
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  <Github className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  <UserPlus className="h-3.5 w-3.5" />
                </button>
                <div className="mx-1 h-3.5 w-px bg-border"></div>
                <button
                  type="button"
                  className="inline-flex h-6 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  <Globe className="h-3.5 w-3.5" /> Deploy
                </button>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </button>
                <div className="ml-2 h-6 w-6 overflow-hidden rounded-full ring-1 ring-border/50">
                  <img
                    src="https://github.com/shadcn.png"
                    alt="Avatar"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            </div>

            <div className="flex h-9 items-center justify-between border-b border-border bg-[hsl(var(--vibe-workspace))] px-2">
              <div className="flex w-full items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => setIsAssistantPanelOpen((prev) => !prev)}
                  className="relative inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                  aria-label={
                    isAssistantPanelOpen
                      ? "Close assistant panel"
                      : "Open assistant panel"
                  }
                >
                  <PanelLeft className="h-3.5 w-3.5" />
                  {isAssistantPanelOpen ? (
                    <span className="absolute -right-0.5 -top-0.5 flex h-3 w-3 items-center justify-center rounded-full bg-primary text-[8px] font-bold text-primary-foreground">
                      5
                    </span>
                  ) : null}
                </button>
                <div className="mx-1 h-3.5 w-px bg-border"></div>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                >
                  <RotateCw className="h-3 w-3" />
                </button>

                <div className="mx-2 flex h-6 max-w-md flex-1 items-center gap-1.5 rounded-md border border-border/40 bg-black/5 px-2 text-[11px] text-muted-foreground transition-colors hover:bg-black/10 dark:bg-white/5 dark:hover:bg-white/10">
                  <Globe className="h-3 w-3 opacity-60" />
                  <span className="truncate tracking-wide">
                    /projects/{projectId}
                  </span>
                </div>

                <div className="ml-auto flex items-center gap-0.5">
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-secondary/70 hover:text-foreground"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>

            <div className="flex min-h-0 flex-1">
              <div className="hidden w-56 flex-col border-r border-border bg-[hsl(var(--vibe-panel-2))] lg:flex">
                <div className="flex h-7 items-center justify-between border-b border-border px-2.5 text-[10px] uppercase tracking-wider font-medium text-muted-foreground">
                  <span>Explorer</span>
                  <span className="cursor-pointer hover:text-foreground">
                    ...
                  </span>
                </div>
                <div className="flex-1 overflow-y-auto p-1.5 scrollbar-thin">
                  {files.map((name) => {
                    const isSelected = name.trim() === "App.tsx";
                    return (
                      <button
                        key={name}
                        className={[
                          "flex w-full items-center rounded-sm px-2 py-0.5 text-left text-[11px]",
                          isSelected
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground transition-colors",
                        ].join(" ")}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col bg-[hsl(var(--vibe-editor))]">
                <div className="flex h-8 items-center border-b border-border bg-[hsl(var(--vibe-panel-2))] text-[11px]">
                  <div className="flex h-full items-center border-r border-border border-b border-b-sky-500 px-3 text-sky-400 bg-[hsl(var(--vibe-editor))]">
                    App.tsx
                  </div>
                  <div className="flex h-full items-center border-r border-border px-3 text-muted-foreground hover:bg-secondary/30 cursor-pointer transition-colors">
                    tailwind.config.js
                  </div>
                </div>
                <div className="flex h-6 items-center border-b border-border px-3 text-[10px] text-muted-foreground bg-[hsl(var(--vibe-editor))]">
                  vibe-clone <span className="mx-1.5 opacity-50">&gt;</span> src{" "}
                  <span className="mx-1.5 opacity-50">&gt;</span> App.tsx
                </div>
                <div className="flex-1 overflow-auto p-2 font-mono text-[11px] text-muted-foreground scrollbar-thin">
                  {editorCode.map((line, idx) => (
                    <div
                      key={`${line}-${idx}`}
                      className="flex leading-5 hover:bg-secondary/30"
                    >
                      <span className="w-8 pr-3 text-right opacity-40 select-none">
                        {122 + idx}
                      </span>
                      <span className="whitespace-pre">{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-[160px] flex flex-col border-t border-border bg-[hsl(var(--vibe-terminal))]">
              <div className="flex h-7 items-center justify-between border-b border-border px-3 text-[10px] text-muted-foreground uppercase tracking-wide font-medium">
                <div className="flex items-center gap-3">
                  <span className="cursor-pointer hover:text-foreground transition-colors">
                    Problems
                  </span>
                  <span className="cursor-pointer hover:text-foreground transition-colors">
                    Output
                  </span>
                  <span className="cursor-pointer hover:text-foreground transition-colors">
                    Debug Console
                  </span>
                  <span className="text-foreground border-b border-foreground h-7 flex items-center">
                    Terminal
                  </span>
                  <span className="cursor-pointer hover:text-foreground transition-colors">
                    Ports
                  </span>
                </div>
                <button
                  type="button"
                  className="inline-flex h-5 w-5 items-center justify-center rounded hover:bg-secondary/60 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ChevronRight className="h-3 w-3 rotate-90" />
                </button>
              </div>
              <div className="flex-1 overflow-auto bg-[hsl(var(--vibe-editor))] p-2 font-mono text-[11px] text-emerald-400 scrollbar-thin leading-5">
                <div className="flex items-center gap-2">
                  <span className="text-blue-400 opacity-80">➜</span>{" "}
                  <span className="text-emerald-400">~/vibecode</span>{" "}
                  <span className="text-muted-foreground">$</span> bun run dev
                </div>
                <div className="mt-1 text-yellow-400/90">
                  VITE v8 ready in 128 ms
                </div>
                <div className="mt-1 text-foreground/80">
                  Local: http://localhost:3000/
                </div>
              </div>
            </div>
          </section>
        </div>
      </div>
    </ProtectedRoute>
  );
}
