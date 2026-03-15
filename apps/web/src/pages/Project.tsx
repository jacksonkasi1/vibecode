// ** import lib
import {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  Globe,
  Github,
  Plus,
  Search,
  Settings,
} from "lucide-react";
import { Link, useParams } from "react-router-dom";

// ** import components
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { OrchidsAssistantThread } from "@/components/assistant/orchids-assistant-thread";
import { ModeToggle } from "@/components/ui/mode-toggle";

const files = [
  ".orchids",
  "orchids-clone",
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

  return (
    <ProtectedRoute>
      <div className="h-[100dvh] overflow-hidden bg-background text-foreground">
        <div className="flex h-full">
          <aside className="hidden h-full w-[376px] min-w-[376px] flex-col border-r border-border bg-[hsl(var(--orchids-panel-2))] md:flex">
            <div className="flex h-12 items-center justify-between border-b border-border px-3">
              <div className="flex items-center gap-2">
                <Link
                  to="/apps"
                  className="text-muted-foreground hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
                <span className="text-sm font-medium">
                  Project #{projectId}
                </span>
              </div>
              <ModeToggle />
            </div>

            <OrchidsAssistantThread />
          </aside>

          <section className="relative flex h-full min-w-0 flex-1 flex-col bg-[hsl(var(--orchids-workspace))]">
            <div className="flex h-12 items-center justify-between border-b border-border px-2 sm:px-3">
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/70"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/70"
                >
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
                <div className="ml-1 inline-flex rounded-md border border-border bg-card p-0.5 text-xs">
                  <button className="rounded bg-secondary px-2.5 py-1 text-foreground">
                    Code
                  </button>
                </div>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary/70"
                >
                  <Plus className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="mx-2 min-w-0 flex-1 sm:mx-4 sm:max-w-md">
                <div className="flex h-8 items-center justify-center rounded-md border border-border bg-card px-3 text-xs text-muted-foreground">
                  <Search className="mr-2 h-3.5 w-3.5" /> app
                </div>
              </div>

              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground"
                >
                  <Github className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-7 items-center gap-1 rounded-md border border-border bg-card px-2"
                >
                  <Globe className="h-3.5 w-3.5" /> Deploy
                  <ChevronDown className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-border bg-card text-muted-foreground"
                >
                  <Settings className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>

            <div className="flex min-h-0 flex-1">
              <div className="hidden w-56 flex-col border-r border-border bg-[hsl(var(--orchids-panel-2))] lg:flex">
                <div className="flex h-8 items-center justify-between border-b border-border px-3 text-xs text-muted-foreground">
                  <span>EXPLORER</span>
                  <span>...</span>
                </div>
                <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                  {files.map((name) => {
                    const isSelected = name.trim() === "App.tsx";
                    return (
                      <button
                        key={name}
                        className={[
                          "flex w-full items-center rounded px-2 py-1 text-left text-xs",
                          isSelected
                            ? "bg-secondary text-foreground"
                            : "text-muted-foreground hover:bg-secondary/50",
                        ].join(" ")}
                      >
                        {name}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex min-w-0 flex-1 flex-col bg-[hsl(var(--orchids-editor))]">
                <div className="flex h-9 items-center border-b border-border bg-[hsl(var(--orchids-panel-2))] text-xs">
                  <div className="flex h-full items-center border-r border-border border-b border-b-sky-500 px-3 text-sky-400">
                    App.tsx
                  </div>
                  <div className="flex h-full items-center border-r border-border px-3 text-muted-foreground">
                    tailwind.config.js
                  </div>
                </div>
                <div className="flex h-7 items-center border-b border-border px-3 text-xs text-muted-foreground">
                  orchids-clone &gt; src &gt; App.tsx
                </div>
                <div className="flex-1 overflow-auto p-3 font-mono text-[12px] text-muted-foreground scrollbar-thin">
                  {editorCode.map((line, idx) => (
                    <div
                      key={`${line}-${idx}`}
                      className="flex leading-6 hover:bg-secondary/30"
                    >
                      <span className="w-9 pr-2 text-right opacity-60">
                        {122 + idx}
                      </span>
                      <span>{line}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="h-[180px] border-t border-border bg-[hsl(var(--orchids-terminal))]">
              <div className="flex h-8 items-center justify-between border-b border-border px-3 text-xs text-muted-foreground">
                <div className="flex items-center gap-4">
                  <span>PROBLEMS</span>
                  <span>OUTPUT</span>
                  <span>DEBUG CONSOLE</span>
                  <span className="text-foreground">TERMINAL</span>
                  <span>PORTS</span>
                </div>
                <button
                  type="button"
                  className="inline-flex h-6 w-6 items-center justify-center rounded hover:bg-secondary/60"
                >
                  <ChevronRight className="h-3.5 w-3.5 rotate-90" />
                </button>
              </div>
              <div className="h-[calc(100%-2rem)] overflow-auto bg-[hsl(var(--orchids-editor))] p-3 font-mono text-[12px] text-emerald-400 scrollbar-thin">
                <div>$ bun run dev</div>
                <div className="mt-1 text-yellow-400">
                  VITE v8 ready in 128 ms
                </div>
                <div className="mt-1 text-foreground">
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
