// ** import core packages
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

// ** import database
import { db } from "@repo/db";
import {
  and,
  artifact,
  asc,
  chatMessage,
  chatThread,
  desc,
  eq,
  execution,
  executionEvent,
  workspaceRevision,
} from "@repo/db";
import { newId } from "@repo/db";

// ** import utils
import { logger } from "@repo/logs";
import { GeminiProvider } from "@repo/ai";

// ** import types
import type { ChatMessage, TokenUsage } from "@repo/ai";
import type { ToolCall } from "@repo/ai";

// ** import config
import { env } from "@/config/env";
import { getWorkspaceTools } from "./tools";
import { withWorkspaceLock } from "./lib/workspace-lock";
import { withRetry, isDoomLoop, classifyError } from "./lib/retry";

// ** import agents
import {
  getAgentDefinitionFromMerged,
  loadUserAgents,
  mergeUserAgents,
} from "@repo/ai";

// ** import types (agent registry)
import type { AgentDefinition } from "@repo/ai";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_SYNTHESIZED_FILES = 200;
const MAX_INLINE_FILE_BYTES = 256 * 1024;
const MAX_INLINE_TEXT_CHARS = 120_000;

/**
 * Token threshold (as a fraction of context window) that triggers compaction.
 * When accumulated token usage exceeds this fraction, we summarise the history.
 */
const CONTEXT_COMPACTION_THRESHOLD = 0.8;

/** Context window size for the default model (Gemini 2.0 Flash). */
const DEFAULT_CONTEXT_WINDOW = 1_048_576;

/** Save a checkpoint to DB every N steps. */
const CHECKPOINT_INTERVAL = 10;

/** Update execution.updatedAt every N milliseconds (heartbeat). */
const HEARTBEAT_INTERVAL_MS = 30_000;

// ─── Utility helpers ─────────────────────────────────────────────────────────

function extractTextFromContentJson(contentJson: unknown): string {
  if (!contentJson || typeof contentJson !== "object") return "";
  const maybe = contentJson as { parts?: Array<{ text?: unknown }> };
  if (!Array.isArray(maybe.parts)) return "";
  return maybe.parts
    .map((part) => (typeof part?.text === "string" ? part.text : ""))
    .filter(Boolean)
    .join("\n")
    .trim();
}

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
}

function isLikelyTextBuffer(buffer: Buffer): boolean {
  if (buffer.length === 0) return true;
  let suspicious = 0;
  for (const byte of buffer) {
    if (byte === 0) return false;
    if (byte < 7 || (byte > 14 && byte < 32)) suspicious++;
  }
  return suspicious / buffer.length < 0.03;
}

async function listWorkspaceFiles(
  rootDir: string,
  currentDir: string,
  results: string[],
) {
  const entries = await readdir(currentDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.name === ".git" || entry.name === "node_modules") continue;
    const absolutePath = path.join(currentDir, entry.name);
    const relativePath = path.relative(rootDir, absolutePath);
    if (entry.isDirectory()) {
      await listWorkspaceFiles(rootDir, absolutePath, results);
      continue;
    }
    if (!entry.isFile()) continue;
    const normalized = relativePath.split(path.sep).join("/");
    results.push(normalized);
    if (results.length >= MAX_SYNTHESIZED_FILES) return;
  }
}

async function buildFileArtifacts(
  workspacePath: string,
  executionId: string,
): Promise<Array<typeof artifact.$inferInsert>> {
  const filePaths: string[] = [];
  await listWorkspaceFiles(workspacePath, workspacePath, filePaths);
  const values: Array<typeof artifact.$inferInsert> = [];

  for (const filePath of filePaths.slice(0, MAX_SYNTHESIZED_FILES)) {
    const absolutePath = path.join(workspacePath, filePath);
    const fileStats = await stat(absolutePath);

    let metadata: Record<string, unknown> = {
      note: "Content unavailable",
      truncated: false,
    };

    if (fileStats.size <= MAX_INLINE_FILE_BYTES) {
      const raw = await readFile(absolutePath);
      if (isLikelyTextBuffer(raw)) {
        const fullText = raw.toString("utf-8");
        const truncatedText = fullText.slice(0, MAX_INLINE_TEXT_CHARS);
        metadata = {
          content: truncatedText,
          truncated: fullText.length > truncatedText.length,
        };
      } else {
        metadata = {
          note: "Binary content not rendered in editor",
          truncated: false,
        };
      }
    } else {
      metadata = {
        note: "File too large for inline preview",
        truncated: true,
      };
    }

    values.push({
      id: newId(),
      executionId,
      type: "file",
      name: filePath,
      filePath,
      storagePath: `workspaces/${executionId}/${filePath}`,
      sizeBytes: Number(fileStats.size),
      metadata: JSON.stringify(metadata),
    });
  }

  return values;
}

// ─── Event helpers ────────────────────────────────────────────────────────────

async function appendExecutionEvent(
  executionId: string,
  type: string,
  payload: unknown,
) {
  const [last] = await db
    .select({ seq: executionEvent.seq })
    .from(executionEvent)
    .where(eq(executionEvent.executionId, executionId))
    .orderBy(desc(executionEvent.seq))
    .limit(1);

  const nextSeq = (last?.seq ?? 0) + 1;

  await db.insert(executionEvent).values({
    id: newId(),
    executionId,
    seq: nextSeq,
    type,
    payloadJson: payload,
  });

  return nextSeq;
}

// ─── Thread helpers ───────────────────────────────────────────────────────────

async function getOrCreateThreadId(execRecord: typeof execution.$inferSelect) {
  if (execRecord.threadId) return execRecord.threadId;

  const [existingThread] = await db
    .select({ id: chatThread.id })
    .from(chatThread)
    .where(
      and(
        eq(chatThread.workspaceId, execRecord.workspaceId),
        eq(chatThread.userId, execRecord.userId),
      ),
    )
    .orderBy(desc(chatThread.updatedAt), asc(chatThread.createdAt))
    .limit(1);

  if (existingThread?.id) return existingThread.id;

  const threadId = newId();
  await db.insert(chatThread).values({
    id: threadId,
    workspaceId: execRecord.workspaceId,
    userId: execRecord.userId,
    title: null,
  });

  return threadId;
}

async function buildThreadMessages(
  execRecord: typeof execution.$inferSelect,
  systemPrompt: string,
) {
  const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];
  const threadId = await getOrCreateThreadId(execRecord);

  const threadMessages = await db
    .select()
    .from(chatMessage)
    .where(eq(chatMessage.threadId, threadId))
    .orderBy(asc(chatMessage.createdAt));

  for (const message of threadMessages) {
    if (
      message.role !== "user" &&
      message.role !== "assistant" &&
      message.role !== "system"
    )
      continue;
    const text = extractTextFromContentJson(message.contentJson);
    if (!text) continue;
    messages.push({ role: message.role, content: text });
  }

  if (messages[messages.length - 1]?.role !== "user") {
    messages.push({
      role: "user",
      content: [
        execRecord.prompt,
        "",
        "Execution policy:",
        "- If the user asks to create, modify, or run code/files, use tools first.",
        "- Do not return full source files in chat unless explicitly asked for raw file contents.",
        "- Do not ask the user which command to run; choose a safe default command yourself.",
        "- For 'run HTML/site' requests, run a non-blocking verification command and report what was executed.",
        "- After tools run, respond with a short summary and file paths.",
      ].join("\n"),
    });
  }

  return { messages, threadId };
}

// ─── Task classification ──────────────────────────────────────────────────────

async function classifyTask(
  prompt: string,
  ai: GeminiProvider,
): Promise<"single" | "multi"> {
  try {
    const classificationPrompt = `Classify this coding task as either "single" or "multi".

Rules:
- "single": focused task on one component/file/area, clear scope, can be done by one developer
- "multi": full-feature spanning multiple systems (frontend + backend), "build X from scratch", requires parallel work, complex architecture

Task: ${prompt}

Respond with ONLY the word "single" or "multi" — nothing else.`;

    const response = await ai.chat({
      model: "gemini-2.0-flash",
      messages: [{ role: "user", content: classificationPrompt }],
    });

    const answer = response.content.trim().toLowerCase();
    if (answer.includes("multi")) return "multi";
    return "single";
  } catch (err) {
    logger.warn(`Task classification failed: ${err}. Defaulting to 'single'.`);
    return "single";
  }
}

// ─── Context compaction ───────────────────────────────────────────────────────

async function compactMessages(
  messages: ChatMessage[],
  ai: GeminiProvider,
  modelId: string,
  executionId: string,
): Promise<ChatMessage[]> {
  const systemMsg = messages.find((m) => m.role === "system");
  const nonSystem = messages.filter((m) => m.role !== "system");

  // Keep last 4 messages as-is for immediate context
  const toSummarize = nonSystem.slice(0, -4);
  const toKeep = nonSystem.slice(-4);

  if (toSummarize.length === 0) return messages;

  logger.info(
    `[Exec ${executionId}] Compacting ${toSummarize.length} messages to free context...`,
  );

  const historyText = toSummarize
    .map((m) => `[${m.role.toUpperCase()}]: ${m.content || "(tool call)"}`)
    .join("\n\n");

  const summaryResponse = await ai.chat({
    model: modelId,
    messages: [
      {
        role: "user",
        content: `Summarise the following conversation history concisely. Preserve all important technical details, file paths, decisions made, and work completed. This summary will be inserted as the new start of the conversation.

<conversation_history>
${historyText}
</conversation_history>

Provide a dense technical summary.`,
      },
    ],
  });

  const summaryMsg: ChatMessage = {
    role: "user",
    content: `[COMPACTED HISTORY SUMMARY]\n${summaryResponse.content}\n[END SUMMARY — continuing from current state]`,
  };

  await appendExecutionEvent(executionId, "context:compacted", {
    messagesCompacted: toSummarize.length,
  });

  return [...(systemMsg ? [systemMsg] : []), summaryMsg, ...toKeep];
}

// ─── Heartbeat ────────────────────────────────────────────────────────────────

function startHeartbeat(executionId: string): () => void {
  const interval = setInterval(async () => {
    try {
      await db
        .update(execution)
        .set({ updatedAt: new Date() })
        .where(eq(execution.id, executionId));
    } catch (err) {
      logger.warn(`[Exec ${executionId}] Heartbeat failed: ${err}`);
    }
  }, HEARTBEAT_INTERVAL_MS);

  return () => clearInterval(interval);
}

// ─── Core agent loop ──────────────────────────────────────────────────────────

interface RunAgentLoopOptions {
  executionId: string;
  workspaceId: string;
  agentName: string;
  messages: ChatMessage[];
  ai: GeminiProvider;
  modelId: string;
  worktreeDir: string;
  maxSteps: number;
  logEvent: (msg: string) => void;
  /** Merged registry of built-in + user-defined agents */
  agentRegistry: Record<string, AgentDefinition>;
}

interface AgentLoopResult {
  finalContent: string;
  finalUsage: TokenUsage;
  steps: number;
  isCancelled: boolean;
}

async function runAgentLoop(
  opts: RunAgentLoopOptions,
): Promise<AgentLoopResult> {
  const {
    executionId,
    workspaceId,
    agentName,
    messages: initialMessages,
    ai,
    modelId,
    worktreeDir,
    maxSteps,
    logEvent,
    agentRegistry,
  } = opts;

  const agentDef = getAgentDefinitionFromMerged(agentName, agentRegistry);
  const effectiveModel = agentDef?.model ?? modelId;

  // Build tool set — for orchestrator, pass task tool options
  const taskToolOptions =
    agentName === "orchestrator"
      ? {
          rootExecutionId: executionId,
          workspaceId,
          modelId,
          worktreeDir,
          agentRegistry,
        }
      : undefined;

  const tools = getWorkspaceTools(worktreeDir, agentName, taskToolOptions);
  const toolByName = new Map(tools.map((t) => [t.name, t]));

  const messages = [...initialMessages];
  let step = 0;
  let finalContent = "";
  let finalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };
  let isCancelled = false;
  const recentToolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
  }> = [];

  while (step < maxSteps) {
    // Check for cancellation
    const [currentExec] = await db
      .select({ status: execution.status })
      .from(execution)
      .where(eq(execution.id, executionId))
      .limit(1);

    if (currentExec?.status === "cancelled") {
      logEvent("Execution was cancelled by user. Halting loop.");
      await appendExecutionEvent(executionId, "step:finish", {
        step,
        finishReason: "cancelled",
      });
      isCancelled = true;
      break;
    }

    step++;
    logEvent(`Agent step ${step}...`);
    await appendExecutionEvent(executionId, "step:start", { step, agentName });

    let stepContent = "";
    const stepToolCalls: ToolCall[] = [];
    let stepUsage: TokenUsage | undefined;

    // ── Stream with retry ─────────────────────────────────────────────────────
    let contextOverflow = false;

    try {
      await withRetry(
        async () => {
          stepContent = "";
          stepToolCalls.length = 0;

          for await (const chunk of ai.streamChat({
            model: effectiveModel,
            messages,
            tools,
          })) {
            if (chunk.content) {
              stepContent += chunk.content;
              await appendExecutionEvent(executionId, "assistant:delta", {
                step,
                content: chunk.content,
                agentName,
                usage: chunk.usage ?? null,
              });
            }
            if (chunk.usage) {
              stepUsage = chunk.usage;
            }
            if (chunk.toolCalls?.length) {
              for (const call of chunk.toolCalls) {
                if (!stepToolCalls.some((e) => e.id === call.id)) {
                  stepToolCalls.push(call);
                }
              }
            }
          }
        },
        {
          onRetry: (attempt, err, delayMs) => {
            logEvent(
              `Retry attempt ${attempt} after ${delayMs}ms — ${err.message}`,
            );
            appendExecutionEvent(executionId, "retry:attempt", {
              step,
              attempt,
              delayMs,
              error: err.message,
            }).catch(() => {});
          },
        },
      );
    } catch (err) {
      const classified = classifyError(err);

      if (classified.isCancelled) {
        isCancelled = true;
        break;
      }

      if (classified.isContextOverflow) {
        contextOverflow = true;
        logEvent(
          "Context overflow detected — compacting conversation history...",
        );
      } else {
        // Fatal or unretryable error — propagate up
        throw err;
      }
    }

    // ── Context compaction ────────────────────────────────────────────────────
    if (
      contextOverflow ||
      (stepUsage &&
        stepUsage.totalTokens >
          DEFAULT_CONTEXT_WINDOW * CONTEXT_COMPACTION_THRESHOLD)
    ) {
      const compacted = await compactMessages(
        messages,
        ai,
        effectiveModel,
        executionId,
      ).catch((e) => {
        logger.warn(`Compaction failed: ${e}. Continuing without.`);
        return messages;
      });
      messages.splice(0, messages.length, ...compacted);

      if (contextOverflow) {
        // Retry the step after compaction
        step--;
        continue;
      }
    }

    if (stepUsage) {
      finalUsage.promptTokens += stepUsage.promptTokens;
      finalUsage.completionTokens += stepUsage.completionTokens;
      finalUsage.totalTokens += stepUsage.totalTokens;
    }

    // ── Tool calls ────────────────────────────────────────────────────────────
    if (stepToolCalls.length > 0) {
      messages.push({
        role: "assistant",
        content: stepContent,
        toolCalls: stepToolCalls,
      });

      for (const call of stepToolCalls) {
        recentToolCalls.push({ name: call.name, args: call.arguments });

        // Doom-loop detection
        if (isDoomLoop(recentToolCalls)) {
          logEvent(
            `Doom-loop detected: repeated ${call.name} calls. Injecting warning.`,
          );
          await appendExecutionEvent(executionId, "warn:doomloop", {
            step,
            toolName: call.name,
          });
          messages.push({
            role: "tool",
            toolCallId: call.id,
            content:
              "WARNING: You have called this tool with the same arguments 3 times in a row. This is a doom-loop. Please take a different approach or conclude your response.",
          });
          continue;
        }

        const argsJson = safeJsonStringify(call.arguments);
        const toolTag = `<execute_${call.name}>${argsJson}</execute_${call.name}>`;

        await appendExecutionEvent(executionId, "assistant:delta", {
          step,
          content: `\n${toolTag}\n`,
          agentName,
          usage: null,
        });

        finalContent += `\n${toolTag}\n`;

        await appendExecutionEvent(executionId, "tool:call", {
          step,
          id: call.id,
          name: call.name,
          args: call.arguments,
          agentName,
        });

        const tool = toolByName.get(call.name);
        const toolResult = tool
          ? await tool.execute(call.arguments)
          : `Tool not found: ${call.name}`;

        await appendExecutionEvent(executionId, "tool:result", {
          step,
          id: call.id,
          name: call.name,
          result: toolResult,
          agentName,
        });

        messages.push({
          role: "tool",
          toolCallId: call.id,
          content: toolResult,
        });
      }

      logEvent(
        `Agent step ${step} executed ${stepToolCalls.length} tool call(s).`,
      );
      await appendExecutionEvent(executionId, "step:finish", {
        step,
        finishReason: "tool_calls",
        toolCallCount: stepToolCalls.length,
        agentName,
      });

      // ── Checkpoint every N steps ─────────────────────────────────────────
      if (step % CHECKPOINT_INTERVAL === 0) {
        await appendExecutionEvent(executionId, "checkpoint", {
          step,
          usage: finalUsage,
          agentName,
        }).catch(() => {});
        logEvent(`Checkpoint saved at step ${step}.`);
      }

      continue;
    }

    // ── Natural stop ──────────────────────────────────────────────────────────
    if (stepContent.trim().length > 0) {
      messages.push({ role: "assistant", content: stepContent });
      finalContent += stepContent + "\n";
    }

    logEvent("Agent finished with reason: stop");
    await appendExecutionEvent(executionId, "step:finish", {
      step,
      finishReason: "stop",
      agentName,
    });

    break;
  }

  if (step >= maxSteps) {
    logEvent(`Reached maximum steps (${maxSteps}). Halting loop.`);
    await appendExecutionEvent(executionId, "step:max", {
      step,
      maxSteps,
      agentName,
    });
  }

  return { finalContent, finalUsage, steps: step, isCancelled };
}

// ─── Main entrypoint ──────────────────────────────────────────────────────────

const execAsync = promisify(exec);

export async function runExecution(execRecord: typeof execution.$inferSelect) {
  const stopHeartbeat = startHeartbeat(execRecord.id);

  try {
    const workspacePath = path.join(env.WORKSPACE_DIR, execRecord.workspaceId);
    await mkdir(workspacePath, { recursive: true });

    // ── Ensure git repo ────────────────────────────────────────────────────
    await withWorkspaceLock(
      env.WORKSPACE_DIR,
      execRecord.workspaceId,
      async () => {
        try {
          const isRepo = await stat(path.join(workspacePath, ".git")).catch(
            () => null,
          );
          if (!isRepo) {
            await execAsync(`git init`, { cwd: workspacePath });
            await execAsync(`git config user.name "VIBECode System"`, {
              cwd: workspacePath,
            });
            await execAsync(`git config user.email "system@vibecode.app"`, {
              cwd: workspacePath,
            });
            await execAsync(`git commit --allow-empty -m "Initial commit"`, {
              cwd: workspacePath,
            });
          }
        } catch (err) {
          logger.warn(`Failed to init git in workspace: ${err}`);
        }
      },
    );

    // ── Git worktree setup ────────────────────────────────────────────────
    const worktreeDir = path.join(
      env.WORKSPACE_DIR,
      ".worktrees",
      execRecord.workspaceId,
      execRecord.id,
    );
    const branchName = `exec-${execRecord.id}`;

    await mkdir(path.dirname(worktreeDir), { recursive: true });

    await withWorkspaceLock(
      env.WORKSPACE_DIR,
      execRecord.workspaceId,
      async () => {
        try {
          await execAsync(`git worktree add -b ${branchName} ${worktreeDir}`, {
            cwd: workspacePath,
          });
        } catch (err) {
          throw new Error(`Failed to create git worktree: ${err}`);
        }
      },
    );

    try {
      await execAsync(`git config user.name "VIBECode Agent"`, {
        cwd: worktreeDir,
      });
      await execAsync(`git config user.email "bot@vibecode.app"`, {
        cwd: worktreeDir,
      });
    } catch (err) {
      throw new Error(`Failed to config git worktree: ${err}`);
    }

    if (!env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured in worker environment");
    }

    const ai = new GeminiProvider({ apiKey: env.GEMINI_API_KEY });
    const modelId = execRecord.modelId ?? "gemini-2.0-flash";

    // ── Load user-defined agents & merge with built-ins ───────────────────
    const userAgents = await loadUserAgents(workspacePath);
    const agentRegistry = mergeUserAgents(userAgents);

    const logEvent = (message: string) => {
      logger.info(`[Exec ${execRecord.id}]: ${message}`);
    };

    await appendExecutionEvent(execRecord.id, "status", {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    // ── Task classification ────────────────────────────────────────────────
    let classification: "single" | "multi" = "single";

    // Only classify if this is the root execution (not a sub-agent)
    if (!execRecord.parentExecutionId) {
      classification = await classifyTask(execRecord.prompt, ai);

      await db
        .update(execution)
        .set({ classification })
        .where(eq(execution.id, execRecord.id));

      logEvent(`Task classified as: ${classification}`);
      await appendExecutionEvent(execRecord.id, "classification", {
        classification,
      });
    } else {
      // Sub-agent executions are always single
      classification = "single";
    }

    // ── Choose agent & system prompt ──────────────────────────────────────
    const agentName =
      classification === "multi"
        ? "orchestrator"
        : (execRecord.agentName ?? "coder");

    const agentDef = getAgentDefinitionFromMerged(agentName, agentRegistry);

    const toolsForManifest = getWorkspaceTools(
      worktreeDir,
      agentName,
      agentName === "orchestrator"
        ? {
            rootExecutionId: execRecord.id,
            workspaceId: execRecord.workspaceId,
            modelId,
            worktreeDir,
            agentRegistry,
          }
        : undefined,
    );

    const toolManifest = toolsForManifest
      .map((t) => `- ${t.name}: ${t.description}`)
      .join("\n");

    const baseSystemPrompt = agentDef
      ? `${agentDef.systemPrompt}\n\nActive workspace path: ${worktreeDir}\nAvailable tools:\n${toolManifest}`
      : `You are VIBECode, an expert AI programming assistant.
You have been given a task to complete within a specific workspace.
Active workspace path: ${worktreeDir}
Available tools in this session:
${toolManifest}
Always perform real code changes using tools when code/files are requested.
Never dump full HTML/CSS/JS/TS files in chat for implementation requests.
Write files to the workspace via tools, then report concise results.
If a request says "write/create/build/run", you MUST use tools before final answer.
Never ask the user to choose a command when execute_command is available.
Pick a sensible default command and run it.
execute_command expects a complete command string and you must decide it yourself.
For long-running dev servers, run a short verification command instead of waiting forever.
Keep final responses concise and action-oriented.
Think step-by-step and complete the objective.`;

    const { messages, threadId } = await buildThreadMessages(
      execRecord,
      baseSystemPrompt,
    );

    const maxSteps = agentDef?.maxSteps ?? 50;

    await appendExecutionEvent(execRecord.id, "agent:selected", {
      agentName,
      classification,
      maxSteps,
    });

    // ── Run agent loop ────────────────────────────────────────────────────
    const {
      finalContent,
      finalUsage,
      steps: step,
      isCancelled,
    } = await runAgentLoop({
      executionId: execRecord.id,
      workspaceId: execRecord.workspaceId,
      agentName,
      messages,
      ai,
      modelId,
      worktreeDir,
      maxSteps,
      logEvent,
      agentRegistry,
    });

    let mergeError = "";
    let mergedCommitHash = "";

    // ── Granular git checkpoint ───────────────────────────────────────────
    if (!isCancelled) {
      try {
        await execAsync(`git add .`, { cwd: worktreeDir });
        const { stdout: indexTreeSha } = await execAsync(`git write-tree`, {
          cwd: worktreeDir,
        });
        const { stdout: worktreeTreeSha } = await execAsync(
          `git stash create`,
          { cwd: worktreeDir },
        ).catch(() => execAsync(`git write-tree`, { cwd: worktreeDir }));

        const checkpointPayload = JSON.stringify({
          executionId: execRecord.id,
          workspaceId: execRecord.workspaceId,
          indexTree: indexTreeSha.trim(),
          worktreeTree: worktreeTreeSha.trim() || indexTreeSha.trim(),
          capturedAt: new Date().toISOString(),
        });

        const { stdout: checkpointCommitSha } = await execAsync(
          `git commit-tree ${indexTreeSha.trim()} -m ${JSON.stringify(checkpointPayload)}`,
          { cwd: worktreeDir },
        );

        await execAsync(
          `git update-ref refs/checkpoints/${execRecord.id} ${checkpointCommitSha.trim()}`,
          { cwd: workspacePath },
        ).catch((err) => logger.warn(`Failed to store checkpoint ref: ${err}`));

        logger.info(
          `Checkpoint created for execution ${execRecord.id}: ${checkpointCommitSha.trim()}`,
        );
      } catch (err) {
        logger.warn(`Failed to create checkpoint for ${execRecord.id}: ${err}`);
      }
    }

    // ── Commit & merge worktree ───────────────────────────────────────────
    if (!isCancelled) {
      try {
        await execAsync(`git add .`, { cwd: worktreeDir });
        const { stdout: diff } = await execAsync(`git diff --staged`, {
          cwd: worktreeDir,
        });

        if (diff.trim()) {
          await execAsync(
            `git commit -m "Execution ${execRecord.id} changes"`,
            { cwd: worktreeDir },
          );

          await withWorkspaceLock(
            env.WORKSPACE_DIR,
            execRecord.workspaceId,
            async () => {
              try {
                await execAsync(
                  `git merge ${branchName} --no-ff -m "Merge execution ${execRecord.id}"`,
                  { cwd: workspacePath },
                );

                const { stdout: hashOut } = await execAsync(
                  `git log -1 --format="%H"`,
                  { cwd: workspacePath },
                );
                mergedCommitHash = hashOut.trim();
              } catch (err) {
                logger.warn(
                  `Merge failed for execution ${execRecord.id}: ${err}`,
                );
                await execAsync(`git merge --abort`, {
                  cwd: workspacePath,
                }).catch(() => {});
                mergeError = `Merge conflict with another parallel agent. The agent's work was saved to branch ${branchName} but could not be automatically merged into main.`;
              }
            },
          );
        } else {
          logger.info(
            `Agent ${execRecord.id} made no file changes. Skipping merge.`,
          );
        }
      } catch (err) {
        logger.warn(`Failed to process worktree git commit: ${err}`);
      }
    }

    const finalText = finalContent.trim();
    const resultPayload = JSON.stringify({
      text: finalText,
      usage: finalUsage,
      steps: step,
      agentName,
      classification,
    });

    const synthesizedArtifacts = await buildFileArtifacts(
      worktreeDir,
      execRecord.id,
    );

    // ── Cleanup worktree ──────────────────────────────────────────────────
    await withWorkspaceLock(
      env.WORKSPACE_DIR,
      execRecord.workspaceId,
      async () => {
        try {
          await execAsync(`git worktree remove --force ${worktreeDir}`, {
            cwd: workspacePath,
          }).catch(() => {});
          if (!mergeError && !isCancelled) {
            await execAsync(`git branch -D ${branchName}`, {
              cwd: workspacePath,
            }).catch(() => {});
          }
          await execAsync(`git worktree prune`, {
            cwd: workspacePath,
          }).catch(() => {});
        } catch (err) {
          logger.warn(`Failed to cleanup worktree: ${err}`);
        }
      },
    );

    if (mergeError) throw new Error(mergeError);

    // ── Persist results ───────────────────────────────────────────────────
    await db.transaction(async (tx) => {
      if (!isCancelled) {
        await tx
          .update(execution)
          .set({
            status: "completed",
            result: resultPayload,
            completedAt: new Date(),
            mergedCommitHash: mergedCommitHash || null,
            worktreeBranch: branchName,
            agentName,
            classification,
          })
          .where(eq(execution.id, execRecord.id));
      } else {
        await tx
          .update(execution)
          .set({
            result: resultPayload,
            completedAt: new Date(),
            worktreeBranch: branchName,
          })
          .where(eq(execution.id, execRecord.id));
      }

      await tx.insert(chatMessage).values({
        id: newId(),
        threadId,
        role: "assistant",
        contentJson: {
          parts: [{ type: "text", text: finalText }],
          usage: finalUsage,
          executionId: execRecord.id,
        },
        tokenCount: finalUsage.completionTokens,
      });

      await tx
        .update(chatThread)
        .set({ updatedAt: new Date() })
        .where(eq(chatThread.id, threadId));

      await tx.insert(artifact).values({
        id: newId(),
        executionId: execRecord.id,
        name: "run.log",
        type: "log",
        storagePath: `executions/${execRecord.id}/run.log`,
        sizeBytes: Buffer.byteLength(resultPayload),
        metadata: JSON.stringify({
          note: "Execution log available via execution event timeline",
        }),
      });

      if (synthesizedArtifacts.length > 0 && !isCancelled) {
        await tx.insert(artifact).values(synthesizedArtifacts);
      }

      if (!isCancelled && mergedCommitHash) {
        let parentHash = null;
        try {
          const { stdout: parentOut } = await execAsync(
            `git log -1 --format="%P"`,
            { cwd: workspacePath },
          );
          const parents = parentOut.trim().split(" ");
          parentHash = parents[0] || null;
        } catch {
          // non-fatal
        }

        await tx.insert(workspaceRevision).values({
          id: newId(),
          workspaceId: execRecord.workspaceId,
          executionId: execRecord.id,
          commitHash: mergedCommitHash,
          parentHash,
          createdBy: execRecord.userId,
        });
      }
    });

    if (!isCancelled) {
      await appendExecutionEvent(execRecord.id, "status", {
        status: "completed",
        completedAt: new Date().toISOString(),
        usage: finalUsage,
        steps: step,
        agentName,
        classification,
      });
      logger.info(`Execution ${execRecord.id} completed successfully.`);
    } else {
      logger.info(`Execution ${execRecord.id} was cancelled gracefully.`);
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(`Execution ${execRecord.id} failed: ${errorMessage}`);

    await db
      .update(execution)
      .set({
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      })
      .where(eq(execution.id, execRecord.id));

    try {
      await appendExecutionEvent(execRecord.id, "status", {
        status: "failed",
        errorMessage,
        completedAt: new Date().toISOString(),
      });
    } catch (eventError) {
      logger.error(
        `Failed to append execution failure event for ${execRecord.id}: ${eventError instanceof Error ? eventError.message : String(eventError)}`,
      );
    }
  } finally {
    stopHeartbeat();
  }
}
