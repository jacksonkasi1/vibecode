// ** import core packages
import { GoogleGenAI } from "@google/genai";

// ** import lib
import { BaseProvider } from "./base";

// ** import types
import type {
  ChatRequest,
  ChatResponse,
  StreamChunk,
  ProviderConfig,
  ModelInfo,
  ToolCall,
} from "../types";

const GEMINI_MODELS: ModelInfo[] = [
  {
    id: "gemini-2.5-pro-preview-05-06",
    displayName: "Gemini 2.5 Pro Preview",
    provider: "gemini",
    contextWindow: 1048576,
    maxTokens: 65536,
    capabilities: ["chat", "code", "reasoning", "tools"],
    isDefault: true,
  },
  {
    id: "gemini-2.5-flash-preview-05-20",
    displayName: "Gemini 2.5 Flash Preview",
    provider: "gemini",
    contextWindow: 1048576,
    maxTokens: 65536,
    capabilities: ["chat", "code", "tools"],
  },
  {
    id: "gemini-2.0-flash",
    displayName: "Gemini 2.0 Flash",
    provider: "gemini",
    contextWindow: 1048576,
    maxTokens: 8192,
    capabilities: ["chat", "code", "tools"],
  },
];

export class GeminiProvider extends BaseProvider {
  readonly name = "Google Gemini";
  readonly slug = "gemini";

  private client: GoogleGenAI;

  constructor(config: ProviderConfig) {
    super(config);
    this.client = new GoogleGenAI({ apiKey: config.apiKey });
  }

  async chat(request: ChatRequest): Promise<ChatResponse> {
    const modelId = this.resolveModel(request);

    const contents = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const systemInstruction =
      request.systemPrompt ||
      request.messages.find((m) => m.role === "system")?.content;

    const response = await this.client.models.generateContent({
      model: modelId,
      contents,
      config: {
        maxOutputTokens: request.maxTokens,
        temperature: request.temperature,
        systemInstruction: systemInstruction
          ? { parts: [{ text: systemInstruction }] }
          : undefined,
      },
    });

    const text = response.text ?? "";

    // Extract tool calls from function calls if present
    const toolCalls: ToolCall[] = [];
    const candidates = response.candidates ?? [];
    for (const candidate of candidates) {
      for (const part of candidate.content?.parts ?? []) {
        if (part.functionCall) {
          toolCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
            name: part.functionCall.name ?? "",
            arguments:
              (part.functionCall.args as Record<string, unknown>) ?? {},
          });
        }
      }
    }

    const hasToolCalls = toolCalls.length > 0;

    return {
      content: text,
      toolCalls: hasToolCalls ? toolCalls : undefined,
      finishReason: hasToolCalls ? "tool_calls" : "stop",
      usage: response.usageMetadata
        ? {
            promptTokens: response.usageMetadata.promptTokenCount ?? 0,
            completionTokens: response.usageMetadata.candidatesTokenCount ?? 0,
            totalTokens: response.usageMetadata.totalTokenCount ?? 0,
          }
        : undefined,
    };
  }

  async *streamChat(
    request: ChatRequest,
  ): AsyncGenerator<StreamChunk, void, unknown> {
    const modelId = this.resolveModel(request);

    const contents = request.messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const systemInstruction =
      request.systemPrompt ||
      request.messages.find((m) => m.role === "system")?.content;

    const response = await this.client.models.generateContentStream({
      model: modelId,
      contents,
      config: {
        maxOutputTokens: request.maxTokens,
        temperature: request.temperature,
        systemInstruction: systemInstruction
          ? { parts: [{ text: systemInstruction }] }
          : undefined,
      },
    });

    for await (const chunk of response) {
      const text = chunk.text ?? "";

      yield {
        content: text || undefined,
        usage: chunk.usageMetadata
          ? {
              promptTokens: chunk.usageMetadata.promptTokenCount ?? 0,
              completionTokens: chunk.usageMetadata.candidatesTokenCount ?? 0,
              totalTokens: chunk.usageMetadata.totalTokenCount ?? 0,
            }
          : undefined,
      };
    }
  }

  listModels(): ModelInfo[] {
    return GEMINI_MODELS;
  }
}
