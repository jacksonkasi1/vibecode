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

// ** import types
import type { ChatMessage } from "@repo/ai";

// ** import config
import { env } from "@/config/env";
import { withWorkspaceLock } from "./lib/workspace-lock";
import { runDeepAgentsExecution } from "./lib/deepagents-runtime";

// ** import agents
import { loadUserAgents, mergeUserAgents } from "@repo/ai";

// ─── Constants ───────────────────────────────────────────────────────────────

const MAX_SYNTHESIZED_FILES = 200;
const MAX_INLINE_FILE_BYTES = 256 * 1024;
const MAX_INLINE_TEXT_CHARS = 120_000;

/** Update execution.updatedAt every N milliseconds (heartbeat). */
const HEARTBEAT_INTERVAL_MS = 30_000;

const eventQueues = new Map<string, Promise<number>>();

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
  const previous = eventQueues.get(executionId) ?? Promise.resolve(0);

  const next = previous.then(async () => {
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
  });

  eventQueues.set(
    executionId,
    next.catch(() => 0),
  );

  return next;
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

async function getEditorContext(executionId: string): Promise<
  | {
      activeFilePath?: string | null;
      visibleContent?: string | null;
    }
  | undefined
> {
  const [row] = await db
    .select({ payload: executionEvent.payloadJson })
    .from(executionEvent)
    .where(
      and(
        eq(executionEvent.executionId, executionId),
        eq(executionEvent.type, "editor:context"),
      ),
    )
    .orderBy(desc(executionEvent.seq))
    .limit(1);

  if (!row?.payload || typeof row.payload !== "object") return undefined;

  const payload = row.payload as {
    activeFilePath?: unknown;
    visibleContent?: unknown;
  };

  return {
    activeFilePath:
      typeof payload.activeFilePath === "string"
        ? payload.activeFilePath
        : null,
    visibleContent:
      typeof payload.visibleContent === "string"
        ? payload.visibleContent
        : null,
  };
}

async function buildThreadMessages(
  execRecord: typeof execution.$inferSelect,
  systemPrompt: string,
) {
  const messages: ChatMessage[] = [];
  if (systemPrompt.trim()) {
    messages.push({ role: "system", content: systemPrompt });
  }
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

    const modelId = execRecord.modelId ?? "gemini-3-flash-preview";

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

    // Emit the live filesystem paths so the frontend can direct users to
    // open the right directory in their editor during execution.
    await appendExecutionEvent(execRecord.id, "workspace:path", {
      workspacePath,
      worktreeDir,
    });

    await db
      .update(execution)
      .set({
        status: "running",
        startedAt: new Date(),
        runtime: "deepagents",
        runtimeExecutionId: execRecord.id,
        updatedAt: new Date(),
      })
      .where(eq(execution.id, execRecord.id));

    const agentName = "deepagents";
    const editorContext = await getEditorContext(execRecord.id);
    const { messages, threadId } = await buildThreadMessages(execRecord, "");
    const conversationHistory = messages.filter(
      (message) => message.role !== "system",
    );

    await appendExecutionEvent(execRecord.id, "runtime:selected", {
      runtime: "deepagents",
      modelId,
    });

    const {
      finalContent,
      finalUsage,
      steps: step,
      isCancelled,
      classification,
      selectedSkillSources,
      runtimeExecutionId,
    } = await runDeepAgentsExecution({
      executionId: execRecord.id,
      worktreeDir,
      modelId,
      prompt: execRecord.prompt,
      history: conversationHistory
        .filter(
          (
            message,
          ): message is { role: "user" | "assistant"; content: string } =>
            message.role === "user" || message.role === "assistant",
        )
        .map((message) => ({
          role: message.role,
          content: message.content,
        })),
      editorContext,
      agentRegistry,
      appendExecutionEvent,
      logEvent,
    });

    await db
      .update(execution)
      .set({
        classification,
        runtime: "deepagents",
        runtimeExecutionId,
        selectedSkillsJson:
          selectedSkillSources.length > 0
            ? JSON.stringify(selectedSkillSources)
            : null,
      })
      .where(eq(execution.id, execRecord.id));

    await appendExecutionEvent(execRecord.id, "classification", {
      classification,
    });

    let mergeError = "";
    let mergeStatus: "completed" | "conflicted" | "failed" = "completed";
    let mergedCommitHash = "";

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
                const errorMessage =
                  err instanceof Error ? err.message : String(err);
                logger.warn(
                  `Merge failed for execution ${execRecord.id}: ${errorMessage}`,
                );
                await execAsync(`git merge --abort`, {
                  cwd: workspacePath,
                }).catch(() => {});
                const isConflict =
                  /CONFLICT|would be overwritten by merge|Merge with strategy/i.test(
                    errorMessage,
                  );
                mergeStatus = isConflict ? "conflicted" : "failed";
                mergeError = isConflict
                  ? `Merge conflict with another parallel agent. The agent's work was saved to branch ${branchName} but could not be automatically merged into main.`
                  : `Execution finished, but the final workspace merge failed: ${errorMessage}. The agent's work is preserved on branch ${branchName}.`;
              }
            },
          );
        } else {
          logger.info(
            `Agent ${execRecord.id} made no file changes. Skipping merge.`,
          );
        }
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        logger.warn(`Failed to process worktree git commit: ${errorMessage}`);
        mergeStatus = "failed";
        mergeError = `Execution finished, but preparing or merging git changes failed: ${errorMessage}. The agent's work is preserved on branch ${branchName}.`;
      }
    }

    const finalText = [
      finalContent.trim(),
      mergeError ? `\n\nMerge note: ${mergeError}` : "",
    ]
      .filter(Boolean)
      .join("");
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

    // ── Persist results ───────────────────────────────────────────────────
    await db.transaction(async (tx) => {
      if (!isCancelled) {
        await tx
          .update(execution)
          .set({
            status: mergeError ? mergeStatus : "completed",
            result: resultPayload,
            errorMessage: mergeError || null,
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
      const finalStatus = mergeError ? mergeStatus : "completed";
      await appendExecutionEvent(execRecord.id, "status", {
        status: finalStatus,
        completedAt: new Date().toISOString(),
        usage: finalUsage,
        steps: step,
        agentName,
        classification,
        errorMessage: mergeError || undefined,
      });
      logger.info(
        mergeError
          ? mergeError.includes("Merge conflict")
            ? `Execution ${execRecord.id} completed with merge conflict.`
            : `Execution ${execRecord.id} completed with merge failure.`
          : `Execution ${execRecord.id} completed successfully.`,
      );
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
