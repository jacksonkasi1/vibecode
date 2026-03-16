// ** import core packages
import { mkdir } from "node:fs/promises";
import path from "node:path";

// ** import lib
import { db } from "@repo/db";
import { execution, artifact, eq, and, lt, asc } from "@repo/db";
import { newId } from "@repo/db";
import { logger } from "@repo/logs";
import { GeminiProvider } from "@repo/ai";
import type { ChatMessage, ToolCall } from "@repo/ai";

// ** import config
import { env } from "@/config/env";
import { getWorkspaceTools } from "./tools";

export async function runExecution(execRecord: typeof execution.$inferSelect) {
  try {
    const workspacePath = path.join(env.WORKSPACE_DIR, execRecord.workspaceId);
    await mkdir(workspacePath, { recursive: true });

    if (!env.GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured in worker environment");
    }

    const ai = new GeminiProvider({ apiKey: env.GEMINI_API_KEY });
    const modelId = execRecord.modelId || "gemini-2.5-pro";
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

    logEvent("Starting AI generation...");

    const messages: ChatMessage[] = [{ role: "system", content: systemPrompt }];

    // Build conversation history
    const previousExecutions = await db
      .select()
      .from(execution)
      .where(
        and(
          eq(execution.workspaceId, execRecord.workspaceId),
          lt(execution.createdAt, execRecord.createdAt),
        ),
      )
      .orderBy(asc(execution.createdAt));

    for (const prev of previousExecutions) {
      if (prev.prompt) {
        messages.push({ role: "user", content: prev.prompt });
      }
      if (prev.status === "completed" && prev.result) {
        let assistantText = prev.result;
        try {
          const parsed = JSON.parse(prev.result);
          if (parsed.text) {
            assistantText = parsed.text;
          }
        } catch {
          // Keep raw result
        }
        if (assistantText) {
          messages.push({ role: "assistant", content: assistantText });
        }
      }
    }

    // Add current prompt
    messages.push({ role: "user", content: execRecord.prompt });

    let step = 0;
    const MAX_STEPS = 10; // Prevent infinite loops in Phase 1
    let finalContent = "";
    let finalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

    while (step < MAX_STEPS) {
      step++;
      logEvent(`Agent step ${step}...`);

      const response = await ai.chat({
        model: modelId,
        messages,
        tools,
      });

      if (response.usage) {
        finalUsage.promptTokens += response.usage.promptTokens;
        finalUsage.completionTokens += response.usage.completionTokens;
        finalUsage.totalTokens += response.usage.totalTokens;
      }

      if (response.content) {
        messages.push({ role: "assistant", content: response.content });
        finalContent += response.content + "\n";
      }

      if (
        response.finishReason === "tool_calls" &&
        response.toolCalls &&
        response.toolCalls.length > 0
      ) {
        messages.push({
          role: "assistant",
          content: "",
          toolCalls: response.toolCalls,
        });

        // Execute all tool calls
        for (const toolCall of response.toolCalls) {
          logEvent(`Executing tool: ${toolCall.name}`);
          const tool = tools.find((t) => t.name === toolCall.name);

          let result = "";
          if (!tool) {
            result = `Error: Tool ${toolCall.name} not found`;
          } else {
            result = await tool.execute(
              toolCall.arguments as Record<string, unknown>,
            );
          }

          logEvent(`Tool result length: ${result.length} chars`);
          messages.push({
            role: "tool",
            content: result,
            toolCallId: toolCall.id,
          });
        }
      } else {
        logEvent(`Agent finished with reason: ${response.finishReason}`);
        break; // Stop or max_tokens reached
      }
    }

    if (step >= MAX_STEPS) {
      logEvent(`Reached maximum steps (${MAX_STEPS}). Halting loop.`);
    }

    // Save outputs
    const resultPayload = JSON.stringify({
      text: finalContent.trim(),
      usage: finalUsage,
      steps: step,
    });

    // Save final status to execution
    await db
      .update(execution)
      .set({
        status: "completed",
        result: resultPayload,
        completedAt: new Date(),
      })
      .where(eq(execution.id, execRecord.id));

    // Save a placeholder artifact to demonstrate artifact saving
    await db.insert(artifact).values({
      id: newId(),
      executionId: execRecord.id,
      name: "run.log",
      type: "log",
      storagePath: `executions/${execRecord.id}/run.log`,
      sizeBytes: Buffer.byteLength(resultPayload),
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
  }
}
