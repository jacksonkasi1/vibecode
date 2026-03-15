// ** import core packages
import { useMemo, useState } from "react";
import { ChevronDown, Settings } from "lucide-react";

// ** import components
import { AppLayout } from "@/components/layout/AppLayout";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";

type Provider = "anthropic" | "openai" | "google";

type ModelItem = {
  id: string;
  name: string;
  provider: Provider;
};

type CustomModel = {
  id: string;
};

const models: ModelItem[] = [
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

const providers: Array<{ id: Provider; label: string }> = [
  { id: "anthropic", label: "Anthropic" },
  { id: "openai", label: "OpenAI" },
  { id: "google", label: "Google" },
];

const providerDotStyles: Record<Provider | "custom", string> = {
  anthropic: "bg-orange-500",
  openai: "bg-emerald-500",
  google: "bg-blue-500",
  custom: "bg-slate-400",
};

export default function AIModelSettings() {
  const [customModels, setCustomModels] = useState<CustomModel[]>([
    { id: "custom-1" },
  ]);
  const [enabledModels, setEnabledModels] = useState<Record<string, boolean>>({
    "claude-sonnet": true,
    "gpt-5-3": true,
    "gemini-3-1-pro-preview": true,
    "gemini-3-flash-preview": false,
    "custom-1": false,
  });
  const [defaultModel, setDefaultModel] = useState<string>("claude-sonnet");
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [developerSettingsOpen, setDeveloperSettingsOpen] = useState<
    Record<string, boolean>
  >({});
  const [connectionSettings, setConnectionSettings] = useState<
    Record<string, { apiKey: string; endpoint: string; name: string }>
  >({
    "claude-sonnet": { apiKey: "", endpoint: "", name: "Claude Sonnet 4.6" },
    "gpt-5-3": { apiKey: "", endpoint: "", name: "GPT-5.3 Codex" },
    "gemini-3-1-pro-preview": {
      apiKey: "",
      endpoint: "",
      name: "Gemini 3.1 Pro Preview",
    },
    "gemini-3-flash-preview": {
      apiKey: "",
      endpoint: "",
      name: "Gemini 3 Flash Preview",
    },
    "custom-1": {
      apiKey: "",
      endpoint: "",
      name: "Custom model 1",
    },
  });
  const [modelConfig, setModelConfig] = useState<
    Record<string, { temperature: number; maxTokens: number }>
  >({
    "claude-sonnet": { temperature: 0.7, maxTokens: 4096 },
    "gpt-5-3": { temperature: 0.5, maxTokens: 4096 },
    "gemini-3-1-pro-preview": { temperature: 0.8, maxTokens: 8192 },
    "gemini-3-flash-preview": { temperature: 0.7, maxTokens: 4096 },
    "custom-1": { temperature: 0.7, maxTokens: 4096 },
  });

  const groupedModels = useMemo(() => {
    return providers.map((provider) => ({
      ...provider,
      items: models.filter((model) => model.provider === provider.id),
    }));
  }, []);

  const allModelIds = useMemo(() => {
    return [
      ...models.map((model) => model.id),
      ...customModels.map((m) => m.id),
    ];
  }, [customModels]);

  const enabledCount = Object.values(enabledModels).filter(Boolean).length;

  const toggleModel = (id: string, checked: boolean) => {
    setEnabledModels((current) => {
      const next = {
        ...current,
        [id]: checked,
      };

      if (!checked) {
        setDefaultModel((currentDefault) => {
          if (currentDefault !== id) {
            return currentDefault;
          }

          const nextDefaultId = allModelIds.find((modelId) => next[modelId]);

          return nextDefaultId ?? currentDefault;
        });
      }

      return next;
    });
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

  const updateConnectionSetting = (
    id: string,
    field: "apiKey" | "endpoint" | "name",
    value: string,
  ) => {
    setConnectionSettings((current) => ({
      ...current,
      [id]: {
        ...current[id],
        [field]: value,
      },
    }));
  };

  const toggleRowExpanded = (id: string, open: boolean) => {
    setExpandedRows((current) => ({
      ...current,
      [id]: open,
    }));
  };

  const toggleDeveloperSettings = (id: string, open: boolean) => {
    setDeveloperSettingsOpen((current) => ({
      ...current,
      [id]: open,
    }));
  };

  const addCustomModel = () => {
    const nextIndex = customModels.length + 1;
    const id = `custom-${nextIndex}`;

    setCustomModels((current) => [...current, { id }]);
    setEnabledModels((current) => ({ ...current, [id]: false }));
    setConnectionSettings((current) => ({
      ...current,
      [id]: {
        apiKey: "",
        endpoint: "",
        name: `Custom model ${nextIndex}`,
      },
    }));
    setModelConfig((current) => ({
      ...current,
      [id]: { temperature: 0.7, maxTokens: 4096 },
    }));
  };

  const renderModelRow = (
    id: string,
    name: string,
    dotStyle: string,
    showEndpoint: boolean,
    showNameInput: boolean,
  ) => {
    const isEnabled = Boolean(enabledModels[id]);
    const disableToggle = isEnabled && enabledCount === 1;
    const rowExpanded = Boolean(expandedRows[id]);
    const isDeveloperOpen = Boolean(developerSettingsOpen[id]);

    return (
      <Collapsible
        key={id}
        className="border-b border-border/70 last:border-b-0"
        open={rowExpanded}
        onOpenChange={(open) => toggleRowExpanded(id, open)}
      >
        <div className="flex items-center justify-between px-3 py-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            <span className={`h-2 w-2 rounded-full ${dotStyle}`} aria-hidden />
            <span className="truncate text-sm">{name}</span>
          </div>

          <div className="ml-3 flex items-center gap-2.5">
            <label
              className={`flex items-center gap-1.5 text-xs ${isEnabled ? "text-muted-foreground" : "text-muted-foreground/50"}`}
            >
              <input
                type="radio"
                name="default-model"
                checked={defaultModel === id}
                onChange={() => setDefaultModel(id)}
                disabled={!isEnabled}
                className="h-3 w-3 accent-emerald-500"
              />
              <span>Default</span>
            </label>

            <Switch
              checked={isEnabled}
              onCheckedChange={(checked) => toggleModel(id, Boolean(checked))}
              disabled={disableToggle}
              aria-label={`${name} enabled`}
            />

            <CollapsibleTrigger asChild>
              <button
                type="button"
                className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                aria-label={`Configure ${name}`}
              >
                <Settings className="h-3.5 w-3.5" />
              </button>
            </CollapsibleTrigger>
          </div>
        </div>

        <CollapsibleContent>
          <div className="border-t border-border/70 bg-background/50 px-3 pb-3 pt-1.5">
            <div className="grid gap-2 sm:grid-cols-2">
              {showNameInput ? (
                <label className="space-y-1 text-xs text-muted-foreground sm:col-span-2">
                  <span>Model name</span>
                  <input
                    type="text"
                    value={connectionSettings[id]?.name ?? ""}
                    onChange={(event) =>
                      updateConnectionSetting(id, "name", event.target.value)
                    }
                    className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              ) : null}

              <label className="space-y-1 text-xs text-muted-foreground">
                <span>API Key</span>
                <input
                  type="password"
                  value={connectionSettings[id]?.apiKey ?? ""}
                  onChange={(event) =>
                    updateConnectionSetting(id, "apiKey", event.target.value)
                  }
                  placeholder="Enter API key"
                  className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                />
              </label>

              {showEndpoint ? (
                <label className="space-y-1 text-xs text-muted-foreground">
                  <span>Endpoint</span>
                  <input
                    type="text"
                    value={connectionSettings[id]?.endpoint ?? ""}
                    onChange={(event) =>
                      updateConnectionSetting(
                        id,
                        "endpoint",
                        event.target.value,
                      )
                    }
                    placeholder="https://api.example.com/v1"
                    className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </label>
              ) : null}
            </div>

            <Collapsible
              open={isDeveloperOpen}
              onOpenChange={(open) => toggleDeveloperSettings(id, open)}
            >
              <div className="mt-2.5 overflow-hidden rounded-lg border border-border/70">
                <CollapsibleTrigger asChild>
                  <button
                    type="button"
                    className="flex w-full cursor-pointer items-center justify-between px-2.5 py-1.5 text-left text-xs text-muted-foreground transition-colors hover:bg-muted/50"
                  >
                    <span>Developer Settings</span>
                    <ChevronDown
                      className={`h-3.5 w-3.5 transition-transform ${isDeveloperOpen ? "rotate-180" : ""}`}
                    />
                  </button>
                </CollapsibleTrigger>

                <CollapsibleContent>
                  <div className="grid gap-2 border-t border-border/70 px-2.5 py-2.5 sm:grid-cols-2">
                    <label className="space-y-1 text-xs text-muted-foreground">
                      <span>
                        Temperature ({modelConfig[id]?.temperature.toFixed(1)})
                      </span>
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.1}
                        value={modelConfig[id]?.temperature ?? 0.7}
                        onChange={(event) =>
                          updateTemperature(id, Number(event.target.value))
                        }
                        className="w-full accent-foreground"
                      />
                    </label>

                    <label className="space-y-1 text-xs text-muted-foreground">
                      <span>Max tokens</span>
                      <input
                        type="number"
                        min={256}
                        step={256}
                        value={modelConfig[id]?.maxTokens ?? 4096}
                        onChange={(event) =>
                          updateMaxTokens(id, Number(event.target.value))
                        }
                        className="h-8 w-full rounded-lg border border-input bg-background px-2.5 text-sm text-foreground outline-none ring-offset-background transition-shadow focus-visible:ring-2 focus-visible:ring-ring"
                      />
                    </label>
                  </div>
                </CollapsibleContent>
              </div>
            </Collapsible>
          </div>
        </CollapsibleContent>
      </Collapsible>
    );
  };

  return (
    <ProtectedRoute>
      <AppLayout>
        <div className="mx-auto max-w-3xl px-4 py-7 sm:px-6">
          <h1 className="text-2xl font-semibold tracking-tight">AI Models</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Enable models and choose one default model. Changes save
            automatically.
          </p>

          <section className="mt-7 space-y-6">
            {groupedModels.map((provider) => (
              <div key={provider.id}>
                <h2 className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {provider.label}
                </h2>
                <div className="overflow-hidden rounded-xl border border-border/80 bg-card/30">
                  {provider.items.map((model) =>
                    renderModelRow(
                      model.id,
                      model.name,
                      providerDotStyles[model.provider],
                      false,
                      false,
                    ),
                  )}
                </div>
              </div>
            ))}

            <div>
              <div className="mb-2 flex items-center justify-between">
                <h2 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  Custom
                </h2>
                <Button
                  type="button"
                  size="xs"
                  variant="outline"
                  onClick={addCustomModel}
                  className="h-7 rounded-md px-2 text-xs"
                >
                  Add custom model
                </Button>
              </div>
              <div className="overflow-hidden rounded-xl border border-border/80 bg-card/30">
                {customModels.map((model) =>
                  renderModelRow(
                    model.id,
                    connectionSettings[model.id]?.name ?? "Custom model",
                    providerDotStyles.custom,
                    true,
                    true,
                  ),
                )}
              </div>
            </div>
          </section>
        </div>
      </AppLayout>
    </ProtectedRoute>
  );
}
