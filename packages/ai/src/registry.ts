// ** import types
import type { AIProvider, ModelInfo, ProviderConfig } from "./types";

// ** import lib
import { GeminiProvider } from "./providers/gemini";

type ProviderFactory = (config: ProviderConfig) => AIProvider;

const providerFactories: Record<string, ProviderFactory> = {
  gemini: (config) => new GeminiProvider(config),
};

export class ModelRegistry {
  private providers: Map<string, AIProvider> = new Map();
  private defaultProvider: string | null = null;

  registerProvider(slug: string, config: ProviderConfig): void {
    const factory = providerFactories[slug];
    if (!factory) {
      throw new Error(
        `Unknown provider: ${slug}. Available: ${Object.keys(providerFactories).join(", ")}`,
      );
    }

    const provider = factory(config);
    this.providers.set(slug, provider);

    if (!this.defaultProvider) {
      this.defaultProvider = slug;
    }
  }

  getProvider(slug: string): AIProvider | undefined {
    return this.providers.get(slug);
  }

  getDefaultProvider(): AIProvider | undefined {
    if (!this.defaultProvider) return undefined;
    return this.providers.get(this.defaultProvider);
  }

  setDefaultProvider(slug: string): void {
    if (!this.providers.has(slug)) {
      throw new Error(`Provider "${slug}" is not registered`);
    }
    this.defaultProvider = slug;
  }

  listProviders(): string[] {
    return Array.from(this.providers.keys());
  }

  listAllModels(): ModelInfo[] {
    const models: ModelInfo[] = [];
    for (const provider of this.providers.values()) {
      models.push(...provider.listModels());
    }
    return models;
  }

  findModel(
    modelId: string,
  ): { provider: AIProvider; model: ModelInfo } | undefined {
    for (const provider of this.providers.values()) {
      const model = provider.listModels().find((m) => m.id === modelId);
      if (model) {
        return { provider, model };
      }
    }
    return undefined;
  }
}

/** Singleton registry instance */
export const modelRegistry = new ModelRegistry();
