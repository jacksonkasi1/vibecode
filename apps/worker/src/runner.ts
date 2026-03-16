// ** import core packages
import { mkdir } from "node:fs/promises";
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

// ** import config
import { env } from "@/config/env";
import { getWorkspaceTools } from "./tools";

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
    messages.push({ role: "user", content: execRecord.prompt });
  }

  return { messages, threadId };
}

export async function runExecution(execRecord: typeof execution.$inferSelect) {
  try {
    const workspacePath = path.join(env.WORKSPACE_DIR, execRecord.workspaceId);
    await mkdir(workspacePath, { recursive: true });

    if (!env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured in worker environment");
    }

    const ai = new GeminiProvider({ apiKey: env.GEMINI_API_KEY });
    const modelId = execRecord.modelId || "gemini-2.0-flash";
    const tools = getWorkspaceTools(workspacePath);

    logger.info(
      `Execution ${execRecord.id}: using model ${modelId} in workspace ${workspacePath}`,
    );

    const systemPrompt = `You are VIBECode, an expert AI programming assistant.
You have been given a task to complete within a specific workspace.
You can use tools to read/write files and execute commands.
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

    while (step < MAX_STEPS) {
      step++;
      logEvent(`Agent step ${step}...`);
      await appendExecutionEvent(execRecord.id, "step:start", { step });

      let stepContent = "";
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
      }

      if (stepUsage) {
        finalUsage.promptTokens += stepUsage.promptTokens;
        finalUsage.completionTokens += stepUsage.completionTokens;
        finalUsage.totalTokens += stepUsage.totalTokens;
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

    const finalText = finalContent.trim();
    const resultPayload = JSON.stringify({
      text: finalText,
      usage: finalUsage,
      steps: step,
    });

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
