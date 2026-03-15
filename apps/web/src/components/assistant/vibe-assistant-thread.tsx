// ** import lib
import { useState } from "react";
import {
  AssistantRuntimeProvider,
  ComposerPrimitive,
  MessagePartPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
  useLocalRuntime,
  type ThreadMessage,
  type TextMessagePart,
} from "@assistant-ui/react";
import { ArrowUp, Paperclip } from "lucide-react";

// ** import components
import {
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/attachment";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const modelOptions = [
  "Gemini 3.1 Pro Preview",
  "Gemini 3 Flash Preview",
  "Gemini 3.1 Flash Lite Preview",
] as const;

const modeOptions = ["Agent", "Plan"] as const;

function extractText(message: ThreadMessage): string {
  if (typeof message.content === "string") return message.content;

  const textPart = message.content.find(
    (part): part is TextMessagePart => part.type === "text",
  );

  return textPart?.text ?? "";
}

function UserMessage() {
  return (
    <MessagePrimitive.Root className="rounded-lg border border-border bg-card px-3 py-2 text-sm">
      <UserMessageAttachments />
      <MessagePrimitive.Parts
        components={{
          Text: () => (
            <p className="whitespace-pre-wrap text-sm text-foreground">
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
    <MessagePrimitive.Root className="rounded-lg border border-border bg-[hsl(var(--vibe-panel))] px-3 py-2 text-sm text-muted-foreground">
      <MessagePrimitive.Parts
        components={{
          Text: () => (
            <p className="whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              <MessagePartPrimitive.Text />
            </p>
          ),
        }}
      />
    </MessagePrimitive.Root>
  );
}

export function VibeAssistantThread() {
  const [selectedMode, setSelectedMode] = useState<string>(modeOptions[0]);
  const [selectedModel, setSelectedModel] = useState<string>(modelOptions[0]);

  // Note: To support LangGraph or LangChain in the backend later,
  // replace `useLocalRuntime` with `useEdgeRuntime({ api: "/api/chat" })`
  // or `useExternalMessageConverter` if you have a custom REST API.
  const runtime = useLocalRuntime(
    {
      run: async ({ messages }) => {
        const latestUserMessage = [...messages]
          .reverse()
          .find((message) => message.role === "user");
        const prompt = latestUserMessage ? extractText(latestUserMessage) : "";

        return {
          content: [
            {
              type: "text" as const,
              text:
                prompt.trim().length > 0
                  ? `Queued in Agent mode using ${selectedModel}. I parsed: "${prompt.trim()}". Next, I would scaffold routes and component structure.`
                  : "Ready. Describe the app clone target and I will prepare a scoped implementation plan.",
            },
          ],
        };
      },
    },
    { initialMessages: [] },
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col">
        <ThreadPrimitive.Viewport className="flex-1 space-y-2 overflow-y-auto px-2 py-2 scrollbar-thin">
          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              AssistantMessage,
            }}
          />
        </ThreadPrimitive.Viewport>

        <div className="border-t border-border/50 bg-background/80 p-2">
          <ComposerPrimitive.Root className="relative flex w-full flex-col gap-1.5 rounded-xl border border-input bg-card p-2 shadow-sm transition-all focus-within:border-ring/40 focus-within:ring-1 focus-within:ring-ring/20">
            <ComposerAttachments />

            <ComposerPrimitive.Input
              rows={4}
              placeholder="Ask Vibe anything..."
              className="max-h-44 min-h-[88px] w-full resize-none bg-transparent px-2 pt-1.5 text-sm leading-5 placeholder:text-muted-foreground focus:outline-none"
            />

            <div className="mt-0.5 flex items-center justify-between gap-2 px-1 pb-0.5">
              <div className="flex items-center">
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-6 items-center rounded-full border border-border bg-background px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      {selectedMode}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-28">
                    {modeOptions.map((option) => (
                      <DropdownMenuItem
                        key={option}
                        onClick={() => setSelectedMode(option)}
                      >
                        {option}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="ml-1 inline-flex h-6 items-center gap-1.5 rounded-full border border-border bg-background px-2.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                    >
                      ✦ {selectedModel}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="start" className="w-56">
                    {modelOptions.map((model) => (
                      <DropdownMenuItem
                        key={model}
                        onClick={() => setSelectedModel(model)}
                      >
                        {model}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
              <div className="flex items-center gap-1.5">
                <ComposerPrimitive.AddAttachment asChild>
                  <button
                    type="button"
                    className="inline-flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  >
                    <Paperclip className="h-3.5 w-3.5" />
                  </button>
                </ComposerPrimitive.AddAttachment>

                <ComposerPrimitive.Send className="inline-flex h-6 w-6 items-center justify-center rounded-md bg-foreground text-background shadow-sm transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-50">
                  <ArrowUp className="h-3.5 w-3.5" />
                </ComposerPrimitive.Send>
              </div>
            </div>
          </ComposerPrimitive.Root>
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
