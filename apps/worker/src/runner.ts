// ** import core packages
import { mkdir, readdir, readFile, stat } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

// ** import lib
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
} from "@repo/db";
import { newId } from "@repo/db";
import { logger } from "@repo/logs";
import { GeminiProvider } from "@repo/ai";

// ** import types
import type { ChatMessage } from "@repo/ai";
import type { ToolCall } from "@repo/ai";

// ** import config
import { env } from "@/config/env";
import { getWorkspaceTools } from "./tools";
import { withWorkspaceLock } from "./lib/workspace-lock";

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

const MAX_SYNTHESIZED_FILES = 200;
const MAX_INLINE_FILE_BYTES = 256 * 1024;
const MAX_INLINE_TEXT_CHARS = 120_000;

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

async function getOrCreateThreadId(execRecord: typeof execution.$inferSelect) {
  if (execRecord.threadId) {
    return execRecord.threadId;
  }

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
    ) {
      continue;
    }

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
        "- For 'run HTML/site' requests, run a non-blocking verification command (for example: ls, file check, or build command) and report what was executed.",
        "- After tools run, respond with a short summary and file paths.",
      ].join("\n"),
    });
  }

  return { messages, threadId };
}

export async function runExecution(execRecord: typeof execution.$inferSelect) {
  try {
    const workspacePath = path.join(env.WORKSPACE_DIR, execRecord.workspaceId);
    await mkdir(workspacePath, { recursive: true });

    const execAsync = promisify(exec);

    // Ensure main workspace is a valid git repo before branching
    await withWorkspaceLock(env.WORKSPACE_DIR, execRecord.workspaceId, async () => {
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
    });

    // Setup Git Worktree for this specific execution
    const worktreeDir = path.join(
      env.WORKSPACE_DIR,
      ".worktrees",
      execRecord.workspaceId,
      execRecord.id,
    );
    const branchName = `exec-${execRecord.id}`;

    await mkdir(path.dirname(worktreeDir), { recursive: true });

    await withWorkspaceLock(env.WORKSPACE_DIR, execRecord.workspaceId, async () => {
      try {
        await execAsync(`git worktree add -b ${branchName} ${worktreeDir}`, {
          cwd: workspacePath,
        });
      } catch (err) {
        throw new Error(`Failed to create git worktree: ${err}`);
      }
    });

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
    const modelId = execRecord.modelId || "gemini-2.0-flash";

    // Tools operate on the WORKTREE directory, completely isolated from main workspace
    const tools = getWorkspaceTools(worktreeDir);
    const toolManifest = tools
      .map((tool) => `- ${tool.name}: ${tool.description}`)
      .join("\n");

    logger.info(
      `Execution ${execRecord.id}: using model ${modelId} in worktree ${worktreeDir}`,
    );

    const systemPrompt = `You are VIBECode, an expert AI programming assistant.
You have been given a task to complete within a specific workspace.
You can use tools to read/write files and execute commands.
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

    const logEvent = (message: string) => {
      logger.info(`[Exec ${execRecord.id}]: ${message}`);
    };

    await appendExecutionEvent(execRecord.id, "status", {
      status: "running",
      startedAt: new Date().toISOString(),
    });

    const { messages, threadId } = await buildThreadMessages(
      execRecord,
      systemPrompt,
    );

    let step = 0;
    const MAX_STEPS = 10;
    let finalContent = "";
    let finalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
    const toolByName = new Map(tools.map((tool) => [tool.name, tool]));
    let isCancelled = false;

    while (step < MAX_STEPS) {
      const [currentExec] = await db
        .select({ status: execution.status })
        .from(execution)
        .where(eq(execution.id, execRecord.id))
        .limit(1);

      if (currentExec && currentExec.status === "cancelled") {
        logEvent("Execution was cancelled by user. Halting loop.");
        await appendExecutionEvent(execRecord.id, "step:finish", {
          step,
          finishReason: "cancelled",
        });
        isCancelled = true;
        break;
      }

      step++;
      logEvent(`Agent step ${step}...`);
      await appendExecutionEvent(execRecord.id, "step:start", { step });

      let stepContent = "";
      const stepToolCalls: ToolCall[] = [];
      let stepUsage:
        | {
            promptTokens: number;
            completionTokens: number;
            totalTokens: number;
          }
        | undefined;

      for await (const chunk of ai.streamChat({
        model: modelId,
        messages,
        tools,
      })) {
        if (chunk.content) {
          stepContent += chunk.content;

          await appendExecutionEvent(execRecord.id, "assistant:delta", {
            step,
            content: chunk.content,
            usage: chunk.usage ?? null,
          });
        }

        if (chunk.usage) {
          stepUsage = chunk.usage;
        }

        if (chunk.toolCalls?.length) {
          for (const call of chunk.toolCalls) {
            const exists = stepToolCalls.some(
              (existing) => existing.id === call.id,
            );
            if (!exists) {
              stepToolCalls.push(call);
            }
          }
        }
      }

      if (stepUsage) {
        finalUsage.promptTokens += stepUsage.promptTokens;
        finalUsage.completionTokens += stepUsage.completionTokens;
        finalUsage.totalTokens += stepUsage.totalTokens;
      }

      if (stepToolCalls.length > 0) {
        messages.push({
          role: "assistant",
          content: stepContent,
          toolCalls: stepToolCalls,
        });

        for (const call of stepToolCalls) {
          const argsJson = safeJsonStringify(call.arguments);
          const toolTag = `<execute_${call.name}>${argsJson}</execute_${call.name}>`;

          await appendExecutionEvent(execRecord.id, "assistant:delta", {
            step,
            content: `\n${toolTag}\n`,
            usage: null,
          });

          finalContent += `\n${toolTag}\n`;

          await appendExecutionEvent(execRecord.id, "tool:call", {
            step,
            id: call.id,
            name: call.name,
            args: call.arguments,
          });

          const tool = toolByName.get(call.name);
          const toolResult = tool
            ? await tool.execute(call.arguments)
            : `Tool not found: ${call.name}`;

          await appendExecutionEvent(execRecord.id, "tool:result", {
            step,
            id: call.id,
            name: call.name,
            result: toolResult,
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
        await appendExecutionEvent(execRecord.id, "step:finish", {
          step,
          finishReason: "tool_calls",
          toolCallCount: stepToolCalls.length,
        });

        continue;
      }

      if (stepContent.trim().length > 0) {
        messages.push({ role: "assistant", content: stepContent });
        finalContent += stepContent + "\n";
      }

      logEvent("Agent finished with reason: stop");
      await appendExecutionEvent(execRecord.id, "step:finish", {
        step,
        finishReason: "stop",
      });

      break;
    }

    if (step >= MAX_STEPS) {
      logEvent(`Reached maximum steps (${MAX_STEPS}). Halting loop.`);
      await appendExecutionEvent(execRecord.id, "step:max", {
        step,
        maxSteps: MAX_STEPS,
      });
    }

    let mergeError = "";

    // If we finished successfully, commit the worktree and merge it back to the main workspace
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

          await withWorkspaceLock(env.WORKSPACE_DIR, execRecord.workspaceId, async () => {
            try {
              // Standard merge. If two agents touch the same lines, we WANT this to fail
              // with a conflict rather than blindly overwriting code via `-X ours`.
              await execAsync(
                `git merge ${branchName} --no-ff -m "Merge execution ${execRecord.id}"`,
                { cwd: workspacePath },
              );
            } catch (err) {
              logger.warn(
                `Merge failed for execution ${execRecord.id}, conflicts detected: ${err}`,
              );
              // If the merge failed with conflicts, we explicitly abort the merge to keep the mainline clean.
              // The user's AI code is preserved safely in the branch ${branchName}.
              await execAsync(`git merge --abort`, { cwd: workspacePath }).catch(
                () => {},
              );
              mergeError = `Merge conflict with another parallel agent. The agent's work was saved to branch ${branchName} but could not be automatically merged into main.`;
            }
          });
        } else {
          logger.info(`Agent ${execRecord.id} made no file changes. Skipping merge.`);
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
    });

    // Extract artifacts from the worktree BEFORE we delete it
    const synthesizedArtifacts = await buildFileArtifacts(
      worktreeDir,
      execRecord.id,
    );

    // Cleanup the worktree
    await withWorkspaceLock(env.WORKSPACE_DIR, execRecord.workspaceId, async () => {
      try {
        await execAsync(`git worktree remove --force ${worktreeDir}`, {
          cwd: workspacePath,
        }).catch(() => {});
        // Only delete the branch if we successfully merged and weren't cancelled
        if (!mergeError && !isCancelled) {
          await execAsync(`git branch -D ${branchName}`, {
            cwd: workspacePath,
          }).catch(() => {});
        }
        await execAsync(`git worktree prune`, { cwd: workspacePath }).catch(() => {});
      } catch (err) {
        logger.warn(`Failed to cleanup worktree: ${err}`);
      }
    });

    if (mergeError) {
      throw new Error(mergeError);
    }

    await db.transaction(async (tx) => {
      await tx
        .update(execution)
        .set({
          status: "completed",
          result: resultPayload,
          completedAt: new Date(),
        })
        .where(eq(execution.id, execRecord.id));

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

      if (synthesizedArtifacts.length > 0) {
        await tx.insert(artifact).values(synthesizedArtifacts);
      }
    });

    await appendExecutionEvent(execRecord.id, "status", {
      status: "completed",
      completedAt: new Date().toISOString(),
      usage: finalUsage,
      steps: step,
    });

    logger.info(`Execution ${execRecord.id} completed successfully.`);
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
  }
}
