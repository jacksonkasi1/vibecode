// ** import types
import type { AgentTask, Execution } from "@repo/db";
import type { FC } from "react";
import type { MessageTiming } from "@assistant-ui/react";

// ** import lib
import {
  useState,
  useEffect,
  createContext,
  useContext,
  useRef,
  useMemo,
} from "react";
import { useQuery } from "@tanstack/react-query";
import {
  AuiIf,
  AssistantRuntimeProvider,
  ChainOfThoughtPrimitive,
  ComposerPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useMessage,
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
  Undo2,
  History,
  Plus,
  Trash2,
  X,
  Search,
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
import { AgentProgress } from "@/components/apps/AgentProgress";
import { AgentTimeline } from "@/components/apps/AgentTimeline";

// ** import apis
import { getAgentTasks } from "@/rest-api/executions";

const ThreadActionContext = createContext<{
  onUndoToMessage?: (messageId: string, promptText: string) => void;
}>({});

const modeOptions = ["Agent", "Plan"] as const;
const modeIcons = {
  Agent: Infinity,
  Plan: Compass,
} as const;

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
      let parsedArgs: Record<string, unknown> = { input: content };
      let argsText = content;

      try {
        const maybe = JSON.parse(content);
        if (maybe && typeof maybe === "object" && !Array.isArray(maybe)) {
          parsedArgs = maybe as Record<string, unknown>;
          argsText = JSON.stringify(maybe, null, 2);
        }
      } catch {
        // content is plain text, keep as-is
      }

      parts.push({
        type: "tool-call",
        toolCallId: toolCallId,
        toolName: tag.replace("execute_", ""),
        args: parsedArgs,
        argsText,
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

const ChainOfThought: FC = () => {
  const timing = useMessageTiming();
  const thoughtSeconds = timing?.totalStreamTime
    ? Math.max(0, Math.floor(timing.totalStreamTime / 1000))
    : 0;

  return (
    <ChainOfThoughtPrimitive.Root className="my-2 rounded-md border border-border/50 bg-muted/20">
      <ChainOfThoughtPrimitive.AccordionTrigger className="flex w-full cursor-pointer items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted/30">
        <AuiIf condition={(s) => s.chainOfThought.collapsed}>
          <ChevronRight className="h-3 w-3" />
        </AuiIf>
        <AuiIf condition={(s) => !s.chainOfThought.collapsed}>
          <ChevronDown className="h-3 w-3" />
        </AuiIf>
        {`Thought for ${thoughtSeconds}s`}
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
  const messageState = useMessage();
  const { onUndoToMessage } = useContext(ThreadActionContext);

  return (
    <div className="group flex w-full flex-col items-end">
      <MessagePrimitive.Root className="w-fit max-w-[78%] rounded-3xl bg-muted/55 px-3.5 py-2 text-sm font-normal text-foreground/95">
        <UserMessageAttachments />
        <MessagePrimitive.Parts
          components={{
            Text: () => (
              <p className="whitespace-pre-wrap break-words leading-6 text-foreground/95">
                <MessagePartPrimitive.Text />
              </p>
            ),
          }}
        />
      </MessagePrimitive.Root>
      {onUndoToMessage && messageState.id.startsWith("u-") && (
        <button
          type="button"
          onClick={() => {
            const text = messageState.content
              .map((c: any) => c.text || "")
              .join("");
            onUndoToMessage(messageState.id.replace("u-", ""), text);
          }}
          className="mt-1 inline-flex h-5 w-5 items-center justify-center rounded-md text-muted-foreground/70 opacity-0 pointer-events-none transition-all hover:bg-secondary/70 hover:text-foreground group-hover:opacity-100 group-hover:pointer-events-auto"
          title="Revert codebase to before this prompt"
        >
          <Undo2 className="size-3" />
        </button>
      )}
    </div>
  );
}

function AssistantMessage() {
  return (
    <MessagePrimitive.Root className="relative w-full py-3 text-sm text-foreground/90">
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
    </MessagePrimitive.Root>
  );
}

function formatElapsed(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

function StreamingIndicator({
  modelName,
  startedAt,
}: {
  modelName?: string;
  startedAt?: Date;
}) {
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  useEffect(() => {
    if (!startedAt) {
      setElapsedSeconds(0);
      return;
    }

    const update = () => {
      const elapsed = Math.max(
        0,
        Math.floor((Date.now() - startedAt.getTime()) / 1000),
      );
      setElapsedSeconds(elapsed);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [startedAt]);

  return (
    <div className="animate-in fade-in slide-in-from-bottom-2 duration-300 py-2">
      <div className="flex items-center gap-2 text-sm text-muted-foreground/80">
        <Sparkles className="size-3.5 animate-pulse text-muted-foreground/70" />
        <span className="font-medium">
          {modelName ? `${modelName} working` : "Working"}
        </span>
        <span aria-hidden>•</span>
        <span>{formatElapsed(elapsedSeconds)}</span>
      </div>
    </div>
  );
}

// ─── Agent Mission Control ────────────────────────────────────────────────────

/**
 * Polls agent tasks for a multi-agent execution and renders progress + timeline.
 */
function AgentMissionControl({
  executionId,
  isRunning,
}: {
  executionId: string;
  isRunning: boolean;
}) {
  const { data } = useQuery<{ data: AgentTask[] }>({
    queryKey: ["agent-tasks", executionId],
    queryFn: () => getAgentTasks(executionId),
    enabled: !!executionId,
    refetchInterval: isRunning ? 3000 : false,
    staleTime: isRunning ? 2000 : Number.POSITIVE_INFINITY,
  });

  const tasks = data?.data ?? [];

  if (tasks.length === 0) return null;

  return (
    <div className="mt-2 flex flex-col gap-3 rounded-xl border border-border/30 bg-muted/15 p-3 text-xs">
      <AgentProgress tasks={tasks} />
      <AgentTimeline tasks={tasks} />
    </div>
  );
}

interface VibeAssistantThreadProps {
  executions: Execution[];
  threads: any[];
  activeThreadId: string | null;
  onSelectThread: (threadId: string | null) => void;
  onSendPrompt: (prompt: string, modelId?: string) => void;
  isSending?: boolean;
  models: { id: string; displayName: string }[];
  runningModelId?: string | null;
  onUndoToMessage?: (messageId: string, promptText: string) => void;
  onRenameThread?: (threadId: string, title: string) => void;
  onDeleteThread?: (threadId: string) => void;
}

export function VibeAssistantThread({
  executions,
  threads,
  activeThreadId,
  onSelectThread,
  onSendPrompt,
  isSending,
  models,
  runningModelId,
  onUndoToMessage,
  onRenameThread,
  onDeleteThread,
}: VibeAssistantThreadProps) {
  const modelList = Array.isArray(models) ? models : [];

  const [selectedMode, setSelectedMode] = useState<
    (typeof modeOptions)[number]
  >(modeOptions[0]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [isHistoryPanelOpen, setIsHistoryPanelOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [isMultiSelectMode, setIsMultiSelectMode] = useState(false);
  const [selectedThreadIds, setSelectedThreadIds] = useState<Set<string>>(
    new Set(),
  );
  const historyPanelRef = useRef<HTMLDivElement | null>(null);

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

  const runningExecution = [...executions]
    .reverse()
    .find((exec) => exec.status === "running" || exec.status === "queued");

  useEffect(() => {
    if (!isHistoryPanelOpen) return;

    const onPointerDown = (event: MouseEvent) => {
      if (!historyPanelRef.current) return;
      const target = event.target as Node;
      if (!historyPanelRef.current.contains(target)) {
        setIsHistoryPanelOpen(false);
      }
    };

    const onEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsHistoryPanelOpen(false);
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onEscape);
    };
  }, [isHistoryPanelOpen]);

  const filteredThreads = useMemo(() => {
    if (!searchQuery.trim()) return threads;
    return threads.filter((t) =>
      (t.title || "Untitled Chat")
        .toLowerCase()
        .includes(searchQuery.toLowerCase()),
    );
  }, [threads, searchQuery]);

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
      const existingParts = assistantText
        ? parseAssistantResponse(assistantText, exec.id)
        : [];
      return [
        base,
        {
          role: "assistant" as const,
          content: [
            ...existingParts,
            {
              type: "text" as const,
              text:
                existingParts.length > 0
                  ? `\n\n**Execution failed.**\n${exec.errorMessage || "Unknown error"}`
                  : `Execution failed.\n\n${exec.errorMessage || "Unknown error"}`,
            },
          ],
          metadata: timing ? { timing } : {},
          id: `a-${exec.id}`,
          createdAt: new Date(String(exec.createdAt)),
        },
      ];
    }

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
      <ThreadActionContext.Provider
        value={{
          onUndoToMessage: (execId, promptText) => {
            if (onUndoToMessage) {
              onUndoToMessage(execId, promptText);
            }
            if (runtime.thread?.composer) {
              runtime.thread.composer.setText(promptText);
            }
          },
        }}
      >
        <TooltipProvider>
          <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col bg-background">
            <ThreadPrimitive.Viewport className="flex-1 overflow-y-auto scrollbar-thin relative">
              {/* Thread Header overlay */}
              <div className="sticky top-0 z-20 h-8 border-b border-border/40 bg-background/95 px-2 backdrop-blur-xl flex items-center justify-between">
                <div className="group/chips flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto pr-2 scrollbar-none [mask-image:linear-gradient(to_right,black_90%,transparent_100%)]">
                  {threads.length === 0 ? (
                    <div className="px-2 text-xs font-medium italic text-muted-foreground/60">
                      No active chats
                    </div>
                  ) : (
                    threads.map((thread) => {
                      const isActive = thread.id === activeThreadId;
                      const isEditing = editingThreadId === thread.id;

                      const handleRenameSubmit = () => {
                        const newTitle = editTitle.trim();
                        if (
                          newTitle &&
                          newTitle !== (thread.title || "Untitled Chat") &&
                          onRenameThread
                        ) {
                          onRenameThread(thread.id, newTitle);
                        }
                        setEditingThreadId(null);
                      };

                      return (
                        <div
                          key={thread.id}
                          role="button"
                          tabIndex={0}
                          onClick={() => onSelectThread(thread.id)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter" || event.key === " ") {
                              event.preventDefault();
                              if (!isEditing) onSelectThread(thread.id);
                            }
                          }}
                          className={[
                            "thread-chip group relative flex h-6.5 items-center gap-1.5 whitespace-nowrap rounded-md px-2.5 text-xs font-medium transition-all duration-200 ease-out focus-visible:outline-none",
                            isActive
                              ? "bg-secondary text-foreground"
                              : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                          ].join(" ")}
                        >
                          {isEditing ? (
                            <input
                              autoFocus
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              onBlur={handleRenameSubmit}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  handleRenameSubmit();
                                } else if (e.key === "Escape") {
                                  setEditingThreadId(null);
                                }
                                e.stopPropagation();
                              }}
                              onClick={(e) => e.stopPropagation()}
                              className="max-w-36 min-w-15 bg-transparent outline-none border-b border-foreground/30 text-xs font-medium text-foreground px-0.5 -mx-0.5"
                            />
                          ) : (
                            <span
                              className="max-w-36 truncate select-none"
                              onDoubleClick={(e) => {
                                e.stopPropagation();
                                setEditingThreadId(thread.id);
                                setEditTitle(thread.title || "Untitled Chat");
                              }}
                              title="Double-click to rename"
                            >
                              {thread.title || "Untitled Chat"}
                            </span>
                          )}

                          {isActive && !isEditing && (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                onSelectThread(null);
                              }}
                              className="-mr-1 ml-0.5 inline-flex size-4 shrink-0 items-center justify-center rounded-sm text-muted-foreground/50 opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100"
                              title="Close tab"
                              aria-label="Close active chat tab"
                            >
                              <Plus className="size-3.5 rotate-45" />
                            </button>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>

                <div className="relative flex shrink-0 items-center gap-0.5 border-l border-border/40 pl-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setIsHistoryPanelOpen((previousState) => !previousState)
                    }
                    className={[
                      "inline-flex size-6.5 items-center justify-center rounded-md transition-all duration-200",
                      isHistoryPanelOpen
                        ? "bg-secondary text-foreground"
                        : "bg-transparent text-muted-foreground hover:bg-secondary/50 hover:text-foreground",
                    ].join(" ")}
                    title="Chat History"
                    aria-label="Toggle chat history panel"
                  >
                    <History className="size-3.5" />
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      onSelectThread(null);
                      setIsHistoryPanelOpen(false);
                    }}
                    className="inline-flex size-6.5 items-center justify-center rounded-md bg-transparent text-muted-foreground transition-all duration-200 hover:bg-secondary/50 hover:text-foreground active:scale-95"
                    title="New Chat"
                    aria-label="Create new chat"
                  >
                    <Plus className="size-3.5" />
                  </button>
                </div>
              </div>

              {/* History Overlay Panel */}
              {isHistoryPanelOpen && (
                <div
                  ref={historyPanelRef}
                  className="absolute inset-0 top-8 z-30 flex flex-col bg-background animate-in fade-in duration-200"
                >
                  <div className="flex h-8 items-center justify-between border-b border-border/20 px-3">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => setIsHistoryPanelOpen(false)}
                        className="text-muted-foreground transition-colors hover:text-foreground"
                      >
                        <ChevronRight className="size-4 rotate-180" />
                      </button>
                      <span className="text-sm font-medium text-foreground">
                        History
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-muted-foreground">
                      <button
                        onClick={() => {
                          setIsMultiSelectMode((prev) => !prev);
                          setSelectedThreadIds(new Set());
                        }}
                        className={`transition-colors hover:text-foreground text-xs px-2 py-0.5 rounded-sm border ${
                          isMultiSelectMode
                            ? "bg-secondary text-foreground border-border/50"
                            : "border-transparent"
                        }`}
                        title="Select Multiple"
                      >
                        Select
                      </button>
                      <button
                        onClick={() => {
                          onSelectThread(null);
                          setIsHistoryPanelOpen(false);
                        }}
                        className="transition-colors hover:text-foreground"
                        title="New Chat"
                      >
                        <Plus className="size-4" />
                      </button>
                      <button
                        onClick={() => setIsHistoryPanelOpen(false)}
                        className="transition-colors hover:text-foreground"
                        title="Close"
                      >
                        <X className="size-4" />
                      </button>
                    </div>
                  </div>

                  <div className="border-b border-border/20 bg-background/50 px-0">
                    <div className="relative flex h-8 items-center">
                      <Search className="absolute left-3 size-3.5 text-muted-foreground/60" />
                      <input
                        type="text"
                        autoFocus
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="Search threads..."
                        className="h-full w-full bg-transparent pl-8 pr-3 text-sm text-foreground outline-none placeholder:text-muted-foreground/60"
                      />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto scrollbar-none pb-4 bg-background">
                    {filteredThreads.length > 0 ? (
                      <div className="flex flex-col">
                        {filteredThreads.map((thread) => {
                          const isActive = thread.id === activeThreadId;
                          const isSelected = selectedThreadIds.has(thread.id);

                          return (
                            <div
                              key={thread.id}
                              className={[
                                "group/history-item flex h-8 w-full cursor-pointer items-center justify-between px-3 text-left transition-colors duration-150 border-b border-border/10 last:border-0",
                                isActive && !isMultiSelectMode
                                  ? "bg-secondary/60 text-foreground"
                                  : "bg-transparent text-foreground/90 hover:bg-secondary/40",
                                isSelected ? "bg-primary/10" : "",
                              ].join(" ")}
                              onClick={() => {
                                if (isMultiSelectMode) {
                                  const newSelected = new Set(
                                    selectedThreadIds,
                                  );
                                  if (newSelected.has(thread.id)) {
                                    newSelected.delete(thread.id);
                                  } else {
                                    newSelected.add(thread.id);
                                  }
                                  setSelectedThreadIds(newSelected);
                                } else {
                                  onSelectThread(thread.id);
                                  setIsHistoryPanelOpen(false);
                                }
                              }}
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-2 pr-2">
                                {isMultiSelectMode && (
                                  <div
                                    className={`size-3.5 rounded border ${
                                      isSelected
                                        ? "bg-primary border-primary"
                                        : "border-border"
                                    }`}
                                  />
                                )}
                                <div className="flex flex-1 justify-between min-w-0">
                                  <span className="truncate text-sm font-medium text-foreground/90">
                                    {thread.title || "Untitled Chat"}
                                  </span>
                                  <span className="text-xs text-muted-foreground/60 shrink-0">
                                    {new Date(
                                      thread.updatedAt,
                                    ).toLocaleTimeString([], {
                                      hour: "numeric",
                                      minute: "2-digit",
                                    })}
                                  </span>
                                </div>
                              </div>

                              {!isMultiSelectMode && (
                                <div className="flex shrink-0 items-center opacity-0 transition-opacity group-hover/history-item:opacity-100">
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (onDeleteThread) {
                                        onDeleteThread(thread.id);
                                      }
                                    }}
                                    className="inline-flex items-center justify-center text-muted-foreground/60 transition-colors hover:text-destructive pl-1"
                                    title="Delete chat"
                                  >
                                    <Trash2 className="size-4" />
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2 px-2 py-8 text-center">
                        <span className="text-sm text-muted-foreground/60">
                          {searchQuery
                            ? "No results found"
                            : "No previous chats"}
                        </span>
                      </div>
                    )}
                  </div>
                  {isMultiSelectMode && selectedThreadIds.size > 0 && (
                    <div className="border-t border-border/20 p-2 bg-background/95">
                      <button
                        onClick={() => {
                          if (
                            onDeleteThread &&
                            window.confirm(
                              `Are you sure you want to delete ${selectedThreadIds.size} thread(s)?`,
                            )
                          ) {
                            for (const id of selectedThreadIds) {
                              onDeleteThread(id);
                            }
                            setSelectedThreadIds(new Set());
                            setIsMultiSelectMode(false);
                          }
                        }}
                        className="w-full flex items-center justify-center gap-2 rounded bg-destructive text-destructive-foreground px-3 py-1.5 text-xs font-bold transition-all hover:bg-destructive/90"
                      >
                        <Trash2 className="size-3.5" />
                        Delete {selectedThreadIds.size} Selected
                      </button>
                    </div>
                  )}
                </div>
              )}

              <div className="flex flex-col space-y-6 px-4 py-6">
                <ThreadPrimitive.Empty>
                  <div className="flex flex-col items-center justify-center pt-16 text-center px-4">
                    <div className="size-10 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
                      <SelectedModeIcon className="size-5 text-primary" />
                    </div>
                    <p className="text-sm font-medium text-foreground">
                      What can I help you build?
                    </p>
                    <p className="text-sm text-muted-foreground mt-1.5 max-w-[250px]">
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
                {/* Agent mission control panels — shown for multi-agent executions */}
                {executions
                  .filter(
                    (exec) =>
                      exec.classification === "multi" &&
                      (!activeThreadId || exec.threadId === activeThreadId),
                  )
                  .map((exec) => (
                    <AgentMissionControl
                      key={exec.id}
                      executionId={exec.id}
                      isRunning={
                        exec.status === "running" || exec.status === "queued"
                      }
                    />
                  ))}
                {isSending && (
                  <StreamingIndicator
                    modelName={
                      runningModelId
                        ? models.find((m) => m.id === runningModelId)
                            ?.displayName
                        : undefined
                    }
                    startedAt={
                      runningExecution?.createdAt
                        ? new Date(String(runningExecution.createdAt))
                        : undefined
                    }
                  />
                )}
              </div>
            </ThreadPrimitive.Viewport>

            <div className="relative mx-[2px] my-[2px] bg-background/45 p-px">
              <div
                aria-hidden
                className="pointer-events-none absolute inset-x-0 -top-8 h-8 bg-gradient-to-t from-background/55 via-background/30 via-60% to-transparent"
              />
              <ComposerPrimitive.Root className="relative mb-[2px] flex w-full flex-col gap-2 rounded-[10px] border border-border/35 bg-card/95 p-3 transition-all focus-within:border-ring/40 focus-within:ring-[0.5px] focus-within:ring-ring/15">
                <ComposerAttachments />

                <ComposerPrimitive.Input
                  rows={1}
                  autoFocus
                  placeholder="Ask Vibe anything..."
                  className="h-auto min-h-11 max-h-28 w-full resize-none overflow-y-auto bg-transparent px-2 py-2 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none"
                  disabled={isSending}
                />

                <div className="flex items-center justify-between gap-2 px-1">
                  <div className="flex items-center">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-6 cursor-pointer items-center gap-1 rounded-full border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          <SelectedModeIcon className="size-3" />
                          {selectedMode}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-28 text-xs"
                      >
                        {modeOptions.map((option) => (
                          <DropdownMenuItem
                            className="px-2 py-1 text-xs"
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
                          className="ml-1 inline-flex h-6 cursor-pointer items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                        >
                          ✦ {selectedModelName}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent
                        align="start"
                        className="w-56 text-xs"
                      >
                        {modelList.map((model) => (
                          <DropdownMenuItem
                            className="px-2 py-1 text-xs"
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
      </ThreadActionContext.Provider>
    </AssistantRuntimeProvider>
  );
}
