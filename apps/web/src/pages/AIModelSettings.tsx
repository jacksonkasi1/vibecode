// ** import lib
import { useState } from "react";
import { Settings2 } from "lucide-react";

// ** import components
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";

type Provider = "vibe" | "anthropic" | "openai" | "google";

type ModelItem = {
  id: string;
  name: string;
  provider: Provider;
  alwaysOn?: boolean;
};

const models: ModelItem[] = [
  { id: "auto", name: "Auto", provider: "vibe", alwaysOn: true },
  { id: "claude-sonnet", name: "Claude Sonnet 4.6", provider: "anthropic" },
  { id: "gpt-5-3", name: "GPT-5.3 Codex", provider: "openai" },
  {
    id: "gemini-3-1-pro-preview",
    name: "Gemini 3.1 Pro Preview",
    provider: "google",
  },
  {
    id: "gemini-3-flash-preview",
    name: "Gemini 3 Flash Preview",
    provider: "google",
  },
];

const apiKeys = [
  "OpenAI API Key",
  "Anthropic API Key",
  "Google AI Studio Key",
] as const;

const providerDotStyles: Record<Provider, string> = {
  vibe: "bg-amber-500",
  anthropic: "bg-orange-500",
  openai: "bg-emerald-500",
  google: "bg-blue-500",
};

export default function AIModelSettings() {
  const [enabledModels, setEnabledModels] = useState<Record<string, boolean>>({
    "claude-sonnet": true,
    "gpt-5-3": false,
    "gemini-3-1-pro-preview": true,
    "gemini-3-flash-preview": false,
  });

  const [modelConfig, setModelConfig] = useState<
    Record<string, { temperature: number; maxTokens: number }>
  >({
    "claude-sonnet": { temperature: 0.7, maxTokens: 4096 },
    "gpt-5-3": { temperature: 0.5, maxTokens: 4096 },
    "gemini-3-1-pro-preview": { temperature: 0.8, maxTokens: 8192 },
    "gemini-3-flash-preview": { temperature: 0.7, maxTokens: 4096 },
  });

  const toggleModel = (id: string, checked: boolean) => {
    setEnabledModels((current) => ({
      ...current,
      [id]: checked,
    }));
  };

  const updateTemperature = (id: string, temperature: number) => {
    setModelConfig((current) => ({
      ...current,
      [id]: {
        ...current[id],
        temperature,
      },
    }));
  };

  const updateMaxTokens = (id: string, maxTokens: number) => {
    setModelConfig((current) => ({
      ...current,
      [id]: {
        ...current[id],
        maxTokens,
      },
    }));
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <h1 className="mb-6 text-2xl font-semibold tracking-tight">Models</h1>

          <section className="mb-8">
            <h2 className="mb-2 text-sm text-muted-foreground">Models</h2>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {models.map((model) => (
                <div
                  key={model.id}
                  className="border-b border-border last:border-b-0"
                >
                  <Collapsible open={Boolean(enabledModels[model.id])}>
                    <div className="flex items-center justify-between px-3 py-3 text-sm">
                      <div className="flex items-center gap-2.5">
                        <span
                          className={`h-2 w-2 rounded-full ${providerDotStyles[model.provider]}`}
                          aria-hidden
                        />
                        <span>{model.name}</span>
                      </div>

                      {model.alwaysOn ? (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>Always on</span>
                          <Settings2 className="h-4 w-4" />
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={Boolean(enabledModels[model.id])}
                            onCheckedChange={(checked) =>
                              toggleModel(model.id, Boolean(checked))
                            }
                            aria-label={`${model.name} enabled`}
                          />
                          <span className="text-xs text-muted-foreground">
                            Enabled
                          </span>
                        </div>
                      )}
                    </div>
                    {!model.alwaysOn ? (
                      <CollapsibleContent>
                        <div className="border-t border-border/80 bg-background/60 px-3 py-2.5">
                          <div className="grid items-end gap-2.5 sm:grid-cols-[1fr_130px]">
                            <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                              <div className="mb-1 flex items-center justify-between text-[11px]">
                                <span className="text-muted-foreground">
                                  Temperature
                                </span>
                                <span>
                                  {modelConfig[model.id]?.temperature.toFixed(
                                    1,
                                  )}
                                </span>
                              </div>
                              <input
                                type="range"
                                min={0}
                                max={1}
                                step={0.1}
                                value={
                                  modelConfig[model.id]?.temperature ?? 0.7
                                }
                                onChange={(event) =>
                                  updateTemperature(
                                    model.id,
                                    Number(event.target.value),
                                  )
                                }
                                className="w-full accent-foreground"
                              />
                            </div>

                            <div className="rounded-md border border-border/60 bg-background px-2.5 py-2">
                              <label
                                htmlFor={`max-tokens-${model.id}`}
                                className="mb-1 block text-[11px] text-muted-foreground"
                              >
                                Max tokens
                              </label>
                              <input
                                id={`max-tokens-${model.id}`}
                                type="number"
                                min={256}
                                step={256}
                                value={modelConfig[model.id]?.maxTokens ?? 4096}
                                onChange={(event) =>
                                  updateMaxTokens(
                                    model.id,
                                    Number(event.target.value),
                                  )
                                }
                                className="h-7 w-full rounded-md border border-input bg-background px-2 text-xs outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                              />
                            </div>
                          </div>
                        </div>
                      </CollapsibleContent>
                    ) : null}
                  </Collapsible>
                </div>
              ))}
            </div>
          </section>

          <section className="mb-8">
            <div className="mb-1 flex items-center gap-2">
              <h2 className="text-sm font-medium">Custom Models</h2>
              <span className="rounded bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Beta
              </span>
            </div>
            <p className="mb-3 text-xs text-muted-foreground">
              Connect OpenAI-compatible API models.
            </p>
            <Button
              type="button"
              variant="outline"
              className="w-full justify-center"
            >
              + Add custom model
            </Button>
          </section>

          <section>
            <h2 className="mb-1 text-sm font-medium">API Keys</h2>
            <p className="mb-3 text-xs text-muted-foreground">
              Your keys are stored locally in your browser.
            </p>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {apiKeys.map((label) => (
                <div
                  key={label}
                  className="flex items-center justify-between border-b border-border px-3 py-3 text-sm last:border-b-0"
                >
                  <span>{label}</span>
                  <Button type="button" size="xs" variant="outline">
                    Configure
                  </Button>
                </div>
              ))}
            </div>
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
