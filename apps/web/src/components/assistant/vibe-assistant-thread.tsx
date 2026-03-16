// ** import types
import type { Execution } from "@repo/db";
import type { FC } from "react";
import type { MessageTiming } from "@assistant-ui/react";

// ** import lib
import { useState, useEffect } from "react";
import {
  AuiIf,
  AssistantRuntimeProvider,
  ChainOfThoughtPrimitive,
  ComposerPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useMessageTiming,
  useExternalStoreRuntime,
} from "@assistant-ui/react";
import {
  ArrowUp,
  ChevronDown,
  ChevronRight,
  Compass,
  Infinity,
  Loader2,
  Paperclip,
  Sparkles,
} from "lucide-react";

// ** import components
import {
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/attachment";
import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { ToolGroup } from "@/components/assistant-ui/tool-group";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";

const modeOptions = ["Agent", "Plan"] as const;
const modeIcons = {
  Agent: Infinity,
  Plan: Compass,
} as const;

function formatMs(ms: number) {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

function extractPartialJSONText(raw: string) {
  try {
    // Simple regex to extract text string from partial JSON
    const match = raw.match(/"(?:text|content|output)"\s*:\s*"([^]*)/);
    if (!match) return raw;
    let extracted = match[1] || "";
    extracted = extracted.replace(/(?:"]?|"?})$/, "");
    return extracted
      .replace(/\\"/g, '"')
      .replace(/\\n/g, "\n")
      .replace(/\\\\/g, "\\");
  } catch {
    return raw;
  }
}

function parseAssistantResponse(text: string, execId: string) {
  const parts: any[] = [];
  const regex = /<(think|execute_[a-z0-9_]+)>([\s\S]*?)?(<\/\1>|$)/gi;
  let lastIndex = 0;
  let match;
  let toolCounter = 0;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const partText = text.substring(lastIndex, match.index).trim();
      if (partText) {
        parts.push({ type: "text", text: partText });
      }
    }

    const tag = match[1].toLowerCase();
    const content = match[2] ? match[2].trim() : "";
    const isClosed = !!match[3];

    if (tag === "think") {
      parts.push({ type: "reasoning", text: content });
    } else {
      toolCounter++;
      const toolCallId = `tc-${execId}-${toolCounter}`;
      parts.push({
        type: "tool-call",
        toolCallId: toolCallId,
        toolName: tag.replace("execute_", ""),
        args: { command: content },
        argsText: `{"command": ${JSON.stringify(content)}}`,
      });
    }

    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    const partText = text.substring(lastIndex).trim();
    if (partText) {
      parts.push({ type: "text", text: partText });
    }
  }

  if (parts.length === 0) {
    parts.push({ type: "text", text });
  }

  return parts;
}

function extractExecutionTextAndUsage(result: string | null) {
  if (!result)
    return { text: "", usage: null as null | { completionTokens?: number } };

  const extractFromParsed = (parsed: unknown) => {
    if (typeof parsed === "string") {
      try {
        return extractFromParsed(JSON.parse(parsed));
      } catch {
        return {
          text: parsed,
          usage: null as null | { completionTokens?: number },
        };
      }
    }

    if (!parsed || typeof parsed !== "object") {
      return {
        text: result,
        usage: null as null | { completionTokens?: number },
      };
    }

    const maybe = parsed as {
      text?: unknown;
      usage?: { completionTokens?: number };
      content?: unknown;
      output?: unknown;
    };

    if (typeof maybe.text === "string") {
      return {
        text: maybe.text,
        usage: maybe.usage ?? null,
      };
    }

    if (typeof maybe.content === "string") {
      return {
        text: maybe.content,
        usage: maybe.usage ?? null,
      };
    }

    if (typeof maybe.output === "string") {
      return {
        text: maybe.output,
        usage: maybe.usage ?? null,
      };
    }

    return { text: result, usage: maybe.usage ?? null };
  };

  try {
    return extractFromParsed(JSON.parse(result));
  } catch {
    return { text: extractPartialJSONText(result), usage: null };
  }
}

function buildTiming(
  execution: Execution,
  completionTokens?: number,
): MessageTiming | undefined {
  // Use createdAt so the badge reflects end-to-end user wait,
  // including queue delay before worker claim.
  const streamStartTime = new Date(String(execution.createdAt)).getTime();
  const endTime = execution.completedAt
    ? new Date(String(execution.completedAt)).getTime()
    : Date.now();
  const totalStreamTime = Math.max(endTime - streamStartTime, 0);

  if (!totalStreamTime) return undefined;

  return {
    streamStartTime,
    totalStreamTime,
    tokenCount: completionTokens,
    tokensPerSecond:
      completionTokens && totalStreamTime > 0
        ? completionTokens / (totalStreamTime / 1000)
        : undefined,
    totalChunks: 1,
    toolCallCount: 0,
  };
}

const MessageTimingBadge: FC = () => {
  const timing = useMessageTiming();
  if (!timing?.totalStreamTime) return null;

  return (
    <div className="mt-2 text-[11px] text-muted-foreground/60">
      {formatMs(timing.totalStreamTime)}
      {timing.tokensPerSecond !== undefined
        ? ` · ${timing.tokensPerSecond.toFixed(1)} tok/s`
        : ""}
    </div>
  );
};

const ChainOfThought: FC = () => {
  return (
    <ChainOfThoughtPrimitive.Root className="my-2 rounded-md border border-border/60 bg-muted/20">
      <ChainOfThoughtPrimitive.AccordionTrigger className="flex w-full cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-[11px] font-medium text-muted-foreground hover:bg-muted/30">
        <AuiIf condition={(s) => s.chainOfThought.collapsed}>
          <ChevronRight className="h-3 w-3" />
        </AuiIf>
        <AuiIf condition={(s) => !s.chainOfThought.collapsed}>
          <ChevronDown className="h-3 w-3" />
        </AuiIf>
        Thinking
      </ChainOfThoughtPrimitive.AccordionTrigger>
      <AuiIf condition={(s) => !s.chainOfThought.collapsed}>
        <div className="px-2.5 pb-2">
          <ChainOfThoughtPrimitive.Parts />
        </div>
      </AuiIf>
    </ChainOfThoughtPrimitive.Root>
  );
};

function UserMessage() {
  return (
    <MessagePrimitive.Root className="ml-auto w-fit max-w-[80%] rounded-2xl bg-secondary px-4 py-2.5 text-[14px]">
      <UserMessageAttachments />
      <MessagePrimitive.Parts
        components={{
          Text: () => (
            <p className="whitespace-pre-wrap text-foreground">
              <MessagePartPrimitive.Text />
            </p>
          ),
        }}
      />
    </MessagePrimitive.Root>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="relative w-full py-4 text-[14px] text-foreground/90">
      <MessagePrimitive.Parts
        components={
          {
            Text: MarkdownText,
            ChainOfThought,
            ToolGroup,
            tools: {
              Fallback: ToolFallback,
            },
          } as any
        }
      />
      <MessageTimingBadge />
    </MessagePrimitive.Root>
  );
}

function StreamingIndicator({ modelName }: { modelName?: string }) {
  return (
    <div className="flex items-start gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-300 py-4">
      <div className="flex items-center gap-2 text-[13px] text-muted-foreground">
        <Sparkles className="size-4 animate-pulse text-primary/70" />
        <span className="font-medium">
          {modelName ? `${modelName} is thinking…` : "Thinking…"}
        </span>
      </div>
    </div>
  );
}

interface VibeAssistantThreadProps {
  executions: Execution[];
  onSendPrompt: (prompt: string, modelId?: string) => void;
  isSending?: boolean;
  models: { id: string; displayName: string }[];
  runningModelId?: string | null;
}

export function VibeAssistantThread({
  executions,
  onSendPrompt,
  isSending,
  models,
  runningModelId,
}: VibeAssistantThreadProps) {
  const modelList = Array.isArray(models) ? models : [];

  const [selectedMode, setSelectedMode] = useState<
    (typeof modeOptions)[number]
  >(modeOptions[0]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");

  useEffect(() => {
    if (modelList.length > 0 && !selectedModelId) {
      const preferredFastModel = modelList.find((model) => {
        const id = model.id.toLowerCase();
        const name = model.displayName.toLowerCase();
        return id.includes("flash") || name.includes("flash");
      });

      setSelectedModelId(preferredFastModel?.id || modelList[0].id);
    }
  }, [modelList, selectedModelId]);

  const selectedModel = modelList.find((m) => m.id === selectedModelId);
  const selectedModelName = selectedModel
    ? selectedModel.displayName
    : "Models";

  const SelectedModeIcon = modeIcons[selectedMode];

  const messages = executions.flatMap((exec) => {
    const { text: assistantText, usage } = extractExecutionTextAndUsage(
      exec.result,
    );
    const timing = buildTiming(exec, usage?.completionTokens);

    const base = {
      role: "user" as const,
      content: [{ type: "text" as const, text: exec.prompt }],
      id: `u-${exec.id}`,
      createdAt: new Date(String(exec.createdAt)),
    };

    if (exec.status === "failed") {
      return [
        base,
        {
          role: "assistant" as const,
          content: [
            {
              type: "text" as const,
              text: `Execution failed.\n\n${exec.errorMessage || "Unknown error"}`,
            },
          ],
          metadata: timing ? { timing } : {},
          id: `a-${exec.id}`,
          createdAt: new Date(String(exec.createdAt)),
        },
      ];
    }

    if (
      assistantText.trim().length > 0 ||
      exec.status === "running" ||
      exec.status === "queued"
    ) {
      return [
        base,
        {
          role: "assistant" as const,
          content: assistantText
            ? parseAssistantResponse(assistantText, exec.id)
            : [{ type: "text" as const, text: "" }],
          metadata: timing ? { timing } : {},
          id: `a-${exec.id}`,
          createdAt: new Date(String(exec.createdAt)),
        },
      ];
    }

    return [base];
  });

  const runtime = useExternalStoreRuntime({
    isRunning: isSending,
    messages,
    convertMessage: (message: any) => ({
      ...message,
      metadata: message.metadata ?? {},
    }),
    onNew: async (message) => {
      if (message.content[0]?.type === "text") {
        onSendPrompt(message.content[0].text, selectedModelId);
      }
    },
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <TooltipProvider>
        <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col">
          <ThreadPrimitive.Viewport className="flex-1 space-y-6 overflow-y-auto px-4 py-6 scrollbar-thin">
            <ThreadPrimitive.Empty>
              <div className="flex flex-col items-center justify-center pt-16 text-center px-4">
                <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                  <SelectedModeIcon className="size-5 text-primary" />
                </div>
                <p className="text-[15px] font-medium text-foreground">
                  What can I help you build?
                </p>
                <p className="text-[13px] text-muted-foreground mt-1.5 max-w-[250px]">
                  Describe your idea, and I'll generate the code.
                </p>
              </div>
            </ThreadPrimitive.Empty>
            <ThreadPrimitive.Messages
              components={{
                UserMessage,
                AssistantMessage,
              }}
            />
            {isSending && (
              <StreamingIndicator
                modelName={
                  runningModelId
                    ? models.find((m) => m.id === runningModelId)?.displayName
                    : undefined
                }
              />
            )}
          </ThreadPrimitive.Viewport>

          <div className="border-t border-border/50 bg-background/80 p-4">
            <ComposerPrimitive.Root className="relative flex w-full flex-col gap-2 rounded-2xl border border-input bg-card p-3 shadow-sm transition-all focus-within:border-ring/50 focus-within:ring-2 focus-within:ring-ring/20">
              <ComposerAttachments />

              <ComposerPrimitive.Input
                rows={1}
                autoFocus
                placeholder="Ask Vibe anything..."
                className="max-h-44 min-h-[44px] w-full resize-none bg-transparent px-2 py-2 text-[14px] leading-relaxed placeholder:text-muted-foreground focus:outline-none"
                disabled={isSending}
              />

              <div className="flex items-center justify-between gap-2 px-1">
                <div className="flex items-center">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-border bg-background px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        <SelectedModeIcon className="size-3" />
                        {selectedMode}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-28 text-[11px]"
                    >
                      {modeOptions.map((option) => (
                        <DropdownMenuItem
                          className="px-2 py-1 text-[11px]"
                          key={option}
                          onClick={() => setSelectedMode(option)}
                        >
                          {option === "Agent" ? (
                            <Infinity className="size-3" />
                          ) : (
                            <Compass className="size-3" />
                          )}
                          {option}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button
                        type="button"
                        className="ml-1 inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                      >
                        ✦ {selectedModelName}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent
                      align="start"
                      className="w-56 text-[11px]"
                    >
                      {modelList.map((model) => (
                        <DropdownMenuItem
                          className="px-2 py-1 text-[11px]"
                          key={model.id}
                          onClick={() => setSelectedModelId(model.id)}
                        >
                          {model.displayName}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                <div className="flex items-center gap-1.5">
                  <ComposerPrimitive.AddAttachment asChild>
                    <button
                      type="button"
                      className="inline-flex h-7 w-7 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      <Paperclip className="h-3.5 w-3.5" />
                    </button>
                  </ComposerPrimitive.AddAttachment>

                  <ComposerPrimitive.Send className="inline-flex h-6 w-6 cursor-pointer items-center justify-center rounded-md bg-foreground text-background shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:pointer-events-none disabled:opacity-50">
                    <ArrowUp className="h-3.5 w-3.5" />
                  </ComposerPrimitive.Send>
                </div>
              </div>
            </ComposerPrimitive.Root>
          </div>
        </ThreadPrimitive.Root>
      </TooltipProvider>
    </AssistantRuntimeProvider>
  );
}
