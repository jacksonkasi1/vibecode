// ** import lib
import { ArrowUp, Grid2X2, Paperclip, Plus } from "lucide-react";
import { Link } from "react-router-dom";

// ** import components
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { OrchidsMark, Panel } from "@/components/orchids-ui";
import { ModeToggle } from "@/components/ui/mode-toggle";
import { Button } from "@/components/ui/button";

const projects = [
  { id: "1", name: "Orchids App Clone" },
  { id: "2", name: "Nexo Studio Clone" },
  { id: "3", name: "Meridian: Architecture of Silence" },
];

const modelOptions = [
  "Gemini 3.1 Pro Preview",
  "Gemini 3 Flash Preview",
  "Gemini 3.1 Flash Lite Preview",
] as const;

export default function Apps() {
  return (
    <ProtectedRoute>
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 pb-8 pt-5 sm:px-6">
          <header className="mb-6 flex items-center justify-end gap-2">
            <ModeToggle />
            <Link to="/account/settings">
              <Button variant="outline" size="sm" className="h-8">
                Settings
              </Button>
            </Link>
          </header>

          <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col pt-4 sm:pt-8">
            <div className="mb-7 flex items-center justify-center gap-2">
              <OrchidsMark className="h-9 w-9" />
              <h1 className="text-4xl font-semibold tracking-tight">orchids</h1>
            </div>

            <Panel className="mb-3 bg-[hsl(var(--orchids-panel-2))]">
              <div className="rounded-2xl border border-input bg-card p-2 shadow-sm transition-all focus-within:border-ring/40 focus-within:ring-1 focus-within:ring-ring/20">
                <textarea
                  placeholder="Enter the prompt"
                  className="max-h-36 min-h-[72px] w-full resize-none bg-transparent px-2 pt-2 text-sm leading-5 placeholder:text-muted-foreground"
                />
                <div className="mt-1 flex items-center justify-between gap-2 px-1 pb-1">
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      ✦ {modelOptions[0]}
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Plus className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-border bg-background text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Grid2X2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                    </button>
                    <Link
                      to="/projects/1"
                      className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-all hover:scale-105 hover:shadow"
                    >
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </Panel>

            <div className="mb-7">
              <button
                type="button"
                className="rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground"
              >
                Create Blank Project
              </button>
            </div>

            <div className="mb-2 flex items-center justify-between">
              <h2 className="text-sm text-muted-foreground">Recent projects</h2>
              <button type="button" className="text-xs text-muted-foreground">
                View all
              </button>
            </div>

            <div className="space-y-0.5">
              {projects.map((project) => (
                <Link
                  key={project.id}
                  to={`/projects/${project.id}`}
                  className="flex items-center justify-between rounded-md px-2 py-2 text-sm hover:bg-secondary/50"
                >
                  <span>{project.name}</span>
                  <span className="text-xs text-muted-foreground">Cloud</span>
                </Link>
              ))}
            </div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
