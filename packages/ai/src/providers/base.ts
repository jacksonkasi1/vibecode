// ** import types
import type {
  AIProvider,
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ProviderConfig,
  ModelInfo,
} from "../types";

export abstract class BaseProvider implements AIProvider {
  abstract readonly name: string;
  abstract readonly slug: string;

  protected config: ProviderConfig;

  constructor(config: ProviderConfig) {
    this.config = config;
  }

  abstract chat(request: ChatRequest): Promise<ChatResponse>;

  abstract streamChat(
    request: ChatRequest,
  ): AsyncGenerator<StreamChunk, void, unknown>;

  abstract listModels(): ModelInfo[];

  protected resolveModel(request: ChatRequest): string {
    return (
      request.model ||
      this.config.defaultModel ||
      this.listModels()[0]?.id ||
      ""
    );
  }
}
