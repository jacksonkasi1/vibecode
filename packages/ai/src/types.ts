// ** Types for AI provider abstraction

export interface ChatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content: string;
  toolCallId?: string;
  toolCalls?: ToolCall[];
}

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: Record<string, unknown>;
}

export interface ChatRequest {
  messages: ChatMessage[];
  model: string;
  tools?: ToolDefinition[];
  maxTokens?: number;
  temperature?: number;
  systemPrompt?: string;
}

export interface ChatResponse {
  content: string;
  toolCalls?: ToolCall[];
  finishReason: "stop" | "tool_calls" | "max_tokens" | "error";
  usage?: TokenUsage;
}

export interface StreamChunk {
  content?: string;
  toolCalls?: ToolCall[];
  finishReason?: "stop" | "tool_calls" | "max_tokens" | "error";
  usage?: TokenUsage;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
}

export interface ModelInfo {
  id: string;
  displayName: string;
  provider: string;
  maxTokens?: number;
  contextWindow?: number;
  capabilities?: string[];
  isDefault?: boolean;
}

export interface ProviderConfig {
  apiKey: string;
  baseUrl?: string;
  defaultModel?: string;
}

export interface AIProvider {
  readonly name: string;
  readonly slug: string;

  chat(request: ChatRequest): Promise<ChatResponse>;
  streamChat(request: ChatRequest): AsyncGenerator<StreamChunk, void, unknown>;
  listModels(): ModelInfo[];
}
