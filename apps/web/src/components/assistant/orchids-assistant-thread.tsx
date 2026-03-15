// ** import lib
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
import { Send } from "lucide-react";

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
    <MessagePrimitive.Root className="rounded-lg border border-border bg-[hsl(var(--orchids-panel))] px-3 py-2 text-sm text-muted-foreground">
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

export function OrchidsAssistantThread() {
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
                  ? `Queued in Agent mode. I parsed: "${prompt.trim()}". Next, I would scaffold routes and component structure to match Orchids while preserving auth.`
                  : "Ready. Describe the app clone target and I will prepare a scoped implementation plan.",
            },
          ],
        };
      },
    },
    {
      initialMessages: [
        {
          role: "assistant",
          content:
            "Workspace ready. This chat is powered by assistant-ui runtime and composer primitives.",
        },
      ],
    },
  );

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <ThreadPrimitive.Root className="flex h-full min-h-0 flex-col">
        <ThreadPrimitive.Viewport className="flex-1 space-y-3 overflow-y-auto p-3 scrollbar-thin">
          <ThreadPrimitive.Messages
            components={{
              UserMessage,
              AssistantMessage,
            }}
          />
        </ThreadPrimitive.Viewport>

        <div className="bg-background p-4">
          <ComposerPrimitive.Root className="relative flex w-full flex-col rounded-2xl border border-input bg-card p-2 shadow-sm transition-all focus-within:border-ring/40 focus-within:ring-1 focus-within:ring-ring/20">
            <ComposerPrimitive.Input
              rows={2}
              placeholder="Ask Orchids anything..."
              className="max-h-36 min-h-[58px] w-full resize-none bg-transparent px-2 pt-2 text-sm leading-5 placeholder:text-muted-foreground focus:outline-none"
            />

            <div className="mt-1 flex items-center justify-end gap-1.5 px-1 pb-1">
              <ComposerPrimitive.Send className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-foreground text-background shadow-sm transition-all hover:scale-105 hover:shadow disabled:pointer-events-none disabled:scale-100 disabled:opacity-50">
                <Send className="h-3.5 w-3.5" />
              </ComposerPrimitive.Send>
            </div>
          </ComposerPrimitive.Root>

          <div className="mt-2 text-center text-[10px] text-muted-foreground/60">
            AI can make mistakes. Please verify important information.
          </div>
        </div>
      </ThreadPrimitive.Root>
    </AssistantRuntimeProvider>
  );
}
