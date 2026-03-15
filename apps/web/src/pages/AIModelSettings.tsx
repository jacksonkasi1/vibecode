// ** import lib
import { useState } from "react";

// ** import components
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";

const providers = ["Google", "OpenAI", "Anthropic"] as const;

export default function AIModelSettings() {
  const [provider, setProvider] =
    useState<(typeof providers)[number]>("Google");
  const [modelName, setModelName] = useState("Gemini 3.1 Pro Preview");
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(4096);

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="mx-auto max-w-2xl px-4 py-8">
          <h1 className="mb-2 text-xl font-semibold">AI Model Settings</h1>
          <p className="mb-6 text-sm text-muted-foreground">
            Configure the default model behavior used when creating new prompts.
          </p>

          <div className="space-y-4">
            <section className="rounded-lg border border-border/60 bg-card p-4 shadow-xs">
              <h2 className="mb-3 text-sm font-medium">Model Provider</h2>
              <div className="flex flex-wrap gap-2">
                {providers.map((item) => (
                  <Button
                    key={item}
                    type="button"
                    size="sm"
                    variant={provider === item ? "default" : "outline"}
                    onClick={() => setProvider(item)}
                  >
                    {item}
                  </Button>
                ))}
              </div>
            </section>

            <section className="rounded-lg border border-border/60 bg-card p-4 shadow-xs">
              <h2 className="mb-3 text-sm font-medium">Default Model</h2>
              <input
                value={modelName}
                onChange={(event) => setModelName(event.target.value)}
                className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
              />
            </section>

            <section className="rounded-lg border border-border/60 bg-card p-4 shadow-xs">
              <h2 className="mb-3 text-sm font-medium">Generation</h2>
              <div className="space-y-4">
                <div>
                  <div className="mb-1 flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Temperature</span>
                    <span>{temperature.toFixed(1)}</span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.1}
                    value={temperature}
                    onChange={(event) =>
                      setTemperature(Number(event.target.value))
                    }
                    className="w-full"
                  />
                </div>

                <div>
                  <label
                    htmlFor="max-tokens"
                    className="mb-1 block text-sm text-muted-foreground"
                  >
                    Max tokens
                  </label>
                  <input
                    id="max-tokens"
                    type="number"
                    min={128}
                    step={128}
                    value={maxTokens}
                    onChange={(event) =>
                      setMaxTokens(Number(event.target.value))
                    }
                    className="h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </div>
            </section>
          </div>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
