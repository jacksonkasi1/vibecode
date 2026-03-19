"use client";

import "@assistant-ui/react-markdown/styles/dot.css";

import {
  type CodeHeaderProps,
  MarkdownTextPrimitive,
  unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
  useIsMarkdownCodeBlock,
} from "@assistant-ui/react-markdown";
import remarkGfm from "remark-gfm";
import { type FC, type ReactNode, isValidElement, memo, useState } from "react";
import { Bot, CheckIcon, CopyIcon, FolderKanban, ListTodo } from "lucide-react";

import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { cn } from "@/lib/utils";

type PlanItem = {
  agent?: string;
  description: string;
  owns: string[];
};

const AGENT_BADGE_STYLES: Record<string, string> = {
  orchestrator:
    "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  coder: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-300",
  frontend:
    "border-pink-500/20 bg-pink-500/10 text-pink-600 dark:text-pink-300",
  backend:
    "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-300",
  tester: "border-teal-500/20 bg-teal-500/10 text-teal-600 dark:text-teal-300",
  researcher:
    "border-indigo-500/20 bg-indigo-500/10 text-indigo-600 dark:text-indigo-300",
  debugger:
    "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-300",
};

function parsePlanItems(raw: string): PlanItem[] | null {
  try {
    const parsed = JSON.parse(raw);
    const source = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.plan)
        ? parsed.plan
        : Array.isArray(parsed?.tasks)
          ? parsed.tasks
          : null;

    if (!source) return null;

    const items = source
      .map((item: unknown): PlanItem | null => {
        if (!item || typeof item !== "object") return null;

        const candidate = item as {
          agent?: unknown;
          description?: unknown;
          title?: unknown;
          text?: unknown;
          summary?: unknown;
          owns?: unknown;
        };

        const descriptionFields = [
          candidate.description,
          candidate.title,
          candidate.text,
          candidate.summary,
        ];
        const description = descriptionFields.find(
          (value): value is string =>
            typeof value === "string" && value.trim().length > 0,
        );

        if (!description) return null;

        const owns = Array.isArray(candidate.owns)
          ? candidate.owns.filter(
              (value: unknown): value is string => typeof value === "string",
            )
          : [];

        return {
          agent:
            typeof candidate.agent === "string" ? candidate.agent : undefined,
          description,
          owns,
        };
      })
      .filter((item: PlanItem | null): item is PlanItem => item !== null);

    return items.length > 0 ? items : null;
  } catch {
    return null;
  }
}

function extractCodeBlock(children: ReactNode) {
  const child = Array.isArray(children) ? children[0] : children;
  if (!isValidElement(child)) return null;

  const props = child.props as {
    className?: string;
    children?: ReactNode;
  };
  const codeChildren = props.children;
  const code = Array.isArray(codeChildren)
    ? codeChildren.join("")
    : typeof codeChildren === "string"
      ? codeChildren
      : null;

  if (!code) return null;

  return {
    className: props.className ?? "",
    code: code.replace(/\n$/, ""),
  };
}

const PlanListBlock: FC<{ items: PlanItem[] }> = ({ items }) => {
  return (
    <div className="my-3 overflow-hidden rounded-2xl border border-border/50 bg-card/80 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between border-b border-border/40 bg-muted/20 px-4 py-3">
        <div className="flex items-center gap-2">
          <ListTodo className="size-4 text-muted-foreground" />
          <span className="text-sm font-semibold text-foreground">Plan</span>
          <span className="rounded-full border border-border/50 bg-background/70 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
            {items.length}
          </span>
        </div>
      </div>

      <div className="space-y-2.5 p-3">
        {items.map((item, index) => {
          const badgeClass = item.agent
            ? (AGENT_BADGE_STYLES[item.agent.toLowerCase()] ??
              "border-border/50 bg-muted/40 text-muted-foreground")
            : "border-border/50 bg-muted/40 text-muted-foreground";

          return (
            <div
              key={`${item.agent ?? "task"}-${index}-${item.description}`}
              className="rounded-xl border border-border/40 bg-background/60 px-3 py-3"
            >
              <div className="flex gap-3">
                <div className="flex pt-1">
                  <span className="mt-1 block size-2 rounded-full border border-muted-foreground/50" />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    {item.agent ? (
                      <span
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em]",
                          badgeClass,
                        )}
                      >
                        <Bot className="size-2.5" />
                        {item.agent}
                      </span>
                    ) : null}

                    <p className="text-sm leading-6 text-foreground/90">
                      {item.description}
                    </p>
                  </div>

                  {item.owns.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {item.owns.map((path) => (
                        <span
                          key={path}
                          className="inline-flex items-center gap-1 rounded-full border border-border/40 bg-muted/30 px-2 py-1 font-mono text-[10px] text-muted-foreground"
                        >
                          <FolderKanban className="size-2.5" />
                          {path}
                        </span>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

const MarkdownTextImpl = () => {
  return (
    <MarkdownTextPrimitive
      remarkPlugins={[remarkGfm]}
      className="aui-md"
      components={defaultComponents}
    />
  );
};

export const MarkdownText = memo(MarkdownTextImpl);

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
  if (language === "json" && parsePlanItems(code ?? "")) {
    return null;
  }

  const { isCopied, copyToClipboard } = useCopyToClipboard();
  const onCopy = () => {
    if (!code || isCopied) return;
    copyToClipboard(code);
  };

  return (
    <div className="aui-code-header-root mt-2.5 flex items-center justify-between rounded-t-lg border border-border/50 border-b-0 bg-muted/50 px-3 py-1.5 text-xs">
      <span className="aui-code-header-language font-medium text-muted-foreground lowercase">
        {language}
      </span>
      <TooltipIconButton tooltip="Copy" onClick={onCopy}>
        {!isCopied && <CopyIcon />}
        {isCopied && <CheckIcon />}
      </TooltipIconButton>
    </div>
  );
};

const useCopyToClipboard = ({
  copiedDuration = 3000,
}: {
  copiedDuration?: number;
} = {}) => {
  const [isCopied, setIsCopied] = useState<boolean>(false);

  const copyToClipboard = (value: string) => {
    if (!value) return;

    navigator.clipboard.writeText(value).then(() => {
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), copiedDuration);
    });
  };

  return { isCopied, copyToClipboard };
};

const defaultComponents = memoizeMarkdownComponents({
  h1: ({ className, ...props }) => (
    <h1
      className={cn(
        "aui-md-h1 mb-2 scroll-m-20 font-semibold text-base first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h2: ({ className, ...props }) => (
    <h2
      className={cn(
        "aui-md-h2 mt-3 mb-1.5 scroll-m-20 font-semibold text-sm first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h3: ({ className, ...props }) => (
    <h3
      className={cn(
        "aui-md-h3 mt-2.5 mb-1 scroll-m-20 font-semibold text-sm first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h4: ({ className, ...props }) => (
    <h4
      className={cn(
        "aui-md-h4 mt-2 mb-1 scroll-m-20 font-medium text-sm first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h5: ({ className, ...props }) => (
    <h5
      className={cn(
        "aui-md-h5 mt-2 mb-1 font-medium text-sm first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  h6: ({ className, ...props }) => (
    <h6
      className={cn(
        "aui-md-h6 mt-2 mb-1 font-medium text-sm first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  p: ({ className, ...props }) => (
    <p
      className={cn(
        "aui-md-p my-2.5 leading-normal first:mt-0 last:mb-0",
        className,
      )}
      {...props}
    />
  ),
  a: ({ className, ...props }) => (
    <a
      className={cn(
        "aui-md-a text-primary underline underline-offset-2 hover:text-primary/80",
        className,
      )}
      {...props}
    />
  ),
  blockquote: ({ className, ...props }) => (
    <blockquote
      className={cn(
        "aui-md-blockquote my-2.5 border-muted-foreground/30 border-l-2 pl-3 text-muted-foreground italic",
        className,
      )}
      {...props}
    />
  ),
  ul: ({ className, ...props }) => (
    <ul
      className={cn(
        "aui-md-ul my-2 ml-4 list-disc marker:text-muted-foreground [&>li]:mt-1",
        className,
      )}
      {...props}
    />
  ),
  ol: ({ className, ...props }) => (
    <ol
      className={cn(
        "aui-md-ol my-2 ml-4 list-decimal marker:text-muted-foreground [&>li]:mt-1",
        className,
      )}
      {...props}
    />
  ),
  hr: ({ className, ...props }) => (
    <hr
      className={cn("aui-md-hr my-2 border-muted-foreground/20", className)}
      {...props}
    />
  ),
  table: ({ className, ...props }) => (
    <table
      className={cn(
        "aui-md-table my-2 w-full border-separate border-spacing-0 overflow-y-auto",
        className,
      )}
      {...props}
    />
  ),
  th: ({ className, ...props }) => (
    <th
      className={cn(
        "aui-md-th bg-muted px-2 py-1 text-left font-medium first:rounded-tl-lg last:rounded-tr-lg [[align=center]]:text-center [[align=right]]:text-right",
        className,
      )}
      {...props}
    />
  ),
  td: ({ className, ...props }) => (
    <td
      className={cn(
        "aui-md-td border-muted-foreground/20 border-b border-l px-2 py-1 text-left last:border-r [[align=center]]:text-center [[align=right]]:text-right",
        className,
      )}
      {...props}
    />
  ),
  tr: ({ className, ...props }) => (
    <tr
      className={cn(
        "aui-md-tr m-0 border-b p-0 first:border-t [&:last-child>td:first-child]:rounded-bl-lg [&:last-child>td:last-child]:rounded-br-lg",
        className,
      )}
      {...props}
    />
  ),
  li: ({ className, ...props }) => (
    <li className={cn("aui-md-li leading-normal", className)} {...props} />
  ),
  sup: ({ className, ...props }) => (
    <sup
      className={cn("aui-md-sup [&>a]:text-xs [&>a]:no-underline", className)}
      {...props}
    />
  ),
  pre: ({ className, ...props }) =>
    (() => {
      const codeBlock = extractCodeBlock(props.children);
      const planItems =
        codeBlock && /language-json/.test(codeBlock.className)
          ? parsePlanItems(codeBlock.code)
          : null;

      if (planItems) {
        return <PlanListBlock items={planItems} />;
      }

      return (
        <pre
          className={cn(
            "aui-md-pre max-h-[26rem] overflow-auto rounded-t-none rounded-b-lg border border-border/50 border-t-0 bg-muted/30 p-3 text-xs leading-relaxed",
            className,
          )}
          {...props}
        />
      );
    })(),
  code: function Code({ className, ...props }) {
    const isCodeBlock = useIsMarkdownCodeBlock();
    return (
      <code
        className={cn(
          !isCodeBlock &&
            "aui-md-inline-code rounded-md border border-border/50 bg-muted/50 px-1.5 py-0.5 font-mono text-[0.85em]",
          className,
        )}
        {...props}
      />
    );
  },
  CodeHeader,
});
