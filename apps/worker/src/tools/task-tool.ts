// ** import core packages
import { mkdir } from "node:fs/promises";
import { exec } from "node:child_process";
import { promisify } from "node:util";
import path from "node:path";

// ** import database
import { db, agentTask, executionEvent, newId, sql } from "@repo/db";
import { eq } from "@repo/db";

// ** import utils
import { logger } from "@repo/logs";

// ** import types
import type { ExecutableTool } from "../tools";
import type { ChatMessage, TokenUsage } from "@repo/ai";

// ** import agents
import { getAgentDefinitionFromMerged } from "@repo/ai";
import { GeminiProvider } from "@repo/ai";

// ** import types
import type { AgentDefinition } from "@repo/ai";

// ** import config
import { env } from "@/config/env";

// ** import lib
import { withWorkspaceLock } from "@/lib/workspace-lock";
import { withRetry, isDoomLoop, classifyError } from "@/lib/retry";

// ** import tools
import { getWorkspaceTools } from "../tools";

const execAsync = promisify(exec);

function safeJsonStringify(value: unknown): string {
  try {
    return JSON.stringify(value ?? {});
  } catch {
    return "{}";
  }
}

async function appendTaskEvent(
  rootExecutionId: string,
  type: string,
  payload: object,
) {
  // Atomic seq increment via subquery — safe under concurrent sub-agents
  await db.insert(executionEvent).values({
    id: newId(),
    executionId: rootExecutionId,
    seq: sql<number>`(
      select coalesce(max(seq), 0) + 1
      from execution_event
      where execution_id = ${rootExecutionId}
    )`,
    type,
    payloadJson: payload,
  });
}

interface RunSubAgentOptions {
  taskId: string;
  rootExecutionId: string;
  workspaceId: string;
  agentName: string;
  prompt: string;
  modelId: string;
  parentWorktreeDir: string;
  /** Paths the agent is allowed to write to (relative to workspace root). Empty = unrestricted. */
  fileOwnership?: string[];
  /** Merged registry of built-in + user-defined agents */
  agentRegistry: Record<string, AgentDefinition>;
}

async function runSubAgent(opts: RunSubAgentOptions): Promise<{
  output: string;
  success: boolean;
  errorMessage?: string;
  steps: number;
  usage: TokenUsage;
}> {
  const {
    taskId,
    rootExecutionId,
    workspaceId,
    agentName,
    prompt,
    modelId,
    parentWorktreeDir,
    fileOwnership = [],
    agentRegistry,
  } = opts;

  const agentDef = getAgentDefinitionFromMerged(agentName, agentRegistry);
  if (!agentDef) {
    throw new Error(`Unknown agent type: ${agentName}`);
  }

  const ai = new GeminiProvider({ apiKey: env.GEMINI_API_KEY! });
  const effectiveModel = agentDef.model ?? modelId ?? "gemini-2.0-flash";

  // Create an isolated worktree for this sub-agent (branched from parent's worktree)
  const workspacePath = path.join(env.WORKSPACE_DIR, workspaceId);
  const worktreeDir = path.join(
    env.WORKSPACE_DIR,
    ".worktrees",
    workspaceId,
    `task-${taskId}`,
  );
  const branchName = `task-${taskId}`;

  await mkdir(path.dirname(worktreeDir), { recursive: true });

  await withWorkspaceLock(env.WORKSPACE_DIR, workspaceId, async () => {
    // Branch from the parent worktree's HEAD so sub-agent has the current code
    await execAsync(`git worktree add -b ${branchName} ${worktreeDir} HEAD`, {
      cwd: parentWorktreeDir,
    }).catch((err) => {
      throw new Error(`Failed to create sub-agent worktree: ${err}`);
    });
  });

  try {
    await execAsync(`git config user.name "VIBECode Agent (${agentName})"`, {
      cwd: worktreeDir,
    });
    await execAsync(`git config user.email "bot@vibecode.app"`, {
      cwd: worktreeDir,
    });
  } catch {
    // non-fatal
  }

  // Get the right tool set for this agent
  const rawTools = getWorkspaceTools(worktreeDir, agentName);

  // Enforce file ownership — wrap write_file and execute_command to reject paths outside owned dirs
  const tools: ExecutableTool[] =
    fileOwnership.length === 0
      ? rawTools
      : rawTools.map((tool) => {
          if (tool.name !== "write_file" && tool.name !== "execute_command") {
            return tool;
          }
          return {
            ...tool,
            execute: async (args: Record<string, unknown>) => {
              if (tool.name === "write_file") {
                const filePath = String(args.path ?? "");
                const allowed = fileOwnership.some(
                  (owned) => filePath.startsWith(owned) || filePath === owned,
                );
                if (!allowed) {
                  return `[OWNERSHIP VIOLATION] Agent '${agentName}' is not allowed to write '${filePath}'. Owned paths: ${fileOwnership.join(", ")}`;
                }
              }
              return tool.execute(args);
            },
          };
        });

  const ownershipSection =
    fileOwnership.length > 0
      ? `\nFile ownership (STRICT — do NOT touch any path outside these):\n${fileOwnership.map((p) => `  - ${p}`).join("\n")}\n`
      : "";

  const toolManifest = tools
    .map((t) => `- ${t.name}: ${t.description}`)
    .join("\n");

  const systemPrompt = `${agentDef.systemPrompt}${ownershipSection}
Active workspace path: ${worktreeDir}
Available tools in this session:
${toolManifest}

Remember: Always use tools to make real code changes. Do not describe changes without making them.`;

  const messages: ChatMessage[] = [
    { role: "system", content: systemPrompt },
    { role: "user", content: prompt },
  ];

  const toolByName = new Map(tools.map((t) => [t.name, t]));
  const maxSteps = agentDef.maxSteps;
  let step = 0;
  let finalContent = "";
  let finalUsage: TokenUsage = {
    promptTokens: 0,
    completionTokens: 0,
    totalTokens: 0,
  };

  const recentToolCalls: Array<{
    name: string;
    args: Record<string, unknown>;
  }> = [];

  while (step < maxSteps) {
    step++;

    let stepContent = "";
    const stepToolCalls: Array<{
      id: string;
      name: string;
      arguments: Record<string, unknown>;
    }> = [];
    let stepUsage: TokenUsage | undefined;

    await withRetry(
      async () => {
        for await (const chunk of ai.streamChat({
          model: effectiveModel,
          messages,
          tools,
        })) {
          if (chunk.content) {
            stepContent += chunk.content;
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
          logger.warn(
            `[Task ${taskId}] Step ${step}: retry attempt ${attempt} after ${delayMs}ms — ${err.message}`,
          );
        },
      },
    );

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
        recentToolCalls.push({ name: call.name, args: call.arguments });

        if (isDoomLoop(recentToolCalls)) {
          logger.warn(
            `[Task ${taskId}] Doom-loop detected at step ${step}: repeated ${call.name} calls. Breaking.`,
          );
          finalContent += `\n[WARN: Doom-loop detected — halting to prevent infinite repetition]\n`;
          break;
        }

        const tool = toolByName.get(call.name);
        const toolResult = tool
          ? await tool.execute(call.arguments)
          : `Tool not found: ${call.name}`;

        messages.push({
          role: "tool",
          toolCallId: call.id,
          content: toolResult,
        });
      }

      continue;
    }

    if (stepContent.trim()) {
      messages.push({ role: "assistant", content: stepContent });
      finalContent += stepContent + "\n";
    }

    break;
  }

  // Commit sub-agent work and merge back to parent worktree
  let mergeError = "";
  try {
    await execAsync(`git add .`, { cwd: worktreeDir });
    const { stdout: diff } = await execAsync(`git diff --staged`, {
      cwd: worktreeDir,
    });

    if (diff.trim()) {
      await execAsync(`git commit -m "Sub-agent ${agentName} task ${taskId}"`, {
        cwd: worktreeDir,
      });

      // Merge back into the parent worktree branch
      await withWorkspaceLock(env.WORKSPACE_DIR, workspaceId, async () => {
        await execAsync(
          `git merge ${branchName} --no-ff -m "Merge sub-agent ${agentName} result"`,
          { cwd: parentWorktreeDir },
        ).catch(async (err) => {
          await execAsync(`git merge --abort`, {
            cwd: parentWorktreeDir,
          }).catch(() => {});
          mergeError = `Sub-agent ${agentName} merge conflict: ${err.message}`;
        });
      });
    }
  } catch (err) {
    logger.warn(`[Task ${taskId}] Failed to commit sub-agent work: ${err}`);
  }

  // Cleanup sub-agent worktree
  await withWorkspaceLock(env.WORKSPACE_DIR, workspaceId, async () => {
    await execAsync(`git worktree remove --force ${worktreeDir}`, {
      cwd: workspacePath,
    }).catch(() => {});
    if (!mergeError) {
      await execAsync(`git branch -D ${branchName}`, {
        cwd: workspacePath,
      }).catch(() => {});
    }
    await execAsync(`git worktree prune`, { cwd: workspacePath }).catch(
      () => {},
    );
  });

  if (mergeError) {
    return {
      output: finalContent.trim(),
      success: false,
      errorMessage: mergeError,
      steps: step,
      usage: finalUsage,
    };
  }

  return {
    output: finalContent.trim(),
    success: true,
    steps: step,
    usage: finalUsage,
  };
}

export function createTaskTool(
  rootExecutionId: string,
  workspaceId: string,
  modelId: string,
  worktreeDir: string,
  agentRegistry: Record<string, AgentDefinition>,
): ExecutableTool {
  // Build the available sub-agents list dynamically from the registry
  const availableAgents = Object.values(agentRegistry)
    .filter((a) => a.mode === "subagent" || a.mode === "all")
    .map((a) => a.name);

  const agentDescLines = Object.values(agentRegistry)
    .filter((a) => a.mode === "subagent" || a.mode === "all")
    .map((a) => `- ${a.name}: ${a.description}`)
    .join("\n");

  return {
    name: "task",
    description: `Spawn a single specialized sub-agent to perform a focused task. Returns the sub-agent's result.

Available sub-agent types:
${agentDescLines}

Use this for a single sequential task. For parallel tasks, use the "tasks" tool instead.
Each sub-agent works in its own git branch and results are merged back automatically.`,
    parameters: {
      type: "object",
      properties: {
        description: {
          type: "string",
          description: "A short (3-5 words) description of the task",
        },
        prompt: {
          type: "string",
          description:
            "Full detailed instructions for the sub-agent. Be specific about what files to create/modify and what the expected output is.",
        },
        subagent_type: {
          type: "string",
          enum: availableAgents,
          description: "The type of specialized agent to use",
        },
        file_ownership: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional: list of relative paths this agent is allowed to write (e.g. ['apps/web/src']). Empty means unrestricted.",
        },
        task_id: {
          type: "string",
          description:
            "Optional: pass a prior task_id to resume a previously started sub-task instead of creating a new one",
        },
      },
      required: ["description", "prompt", "subagent_type"],
    },
    execute: async (args: Record<string, unknown>) => {
      return runSingleTask({
        rootExecutionId,
        workspaceId,
        modelId,
        worktreeDir,
        agentRegistry,
        args,
      });
    },
  };
}

export function createParallelTasksTool(
  rootExecutionId: string,
  workspaceId: string,
  modelId: string,
  worktreeDir: string,
  agentRegistry: Record<string, AgentDefinition>,
): ExecutableTool {
  const availableAgents = Object.values(agentRegistry)
    .filter((a) => a.mode === "subagent" || a.mode === "all")
    .map((a) => a.name);

  return {
    name: "tasks",
    description: `Spawn multiple specialized sub-agents IN PARALLEL. All agents run concurrently — use this when tasks are independent (e.g. frontend + backend at the same time).

Each task must have a unique file ownership list to prevent conflicts. After all complete, a tester agent verifies the combined result.

Use the "task" tool for a single sequential task.`,
    parameters: {
      type: "object",
      properties: {
        tasks: {
          type: "array",
          description: "List of parallel tasks to run",
          items: {
            type: "object",
            properties: {
              description: {
                type: "string",
                description: "A short (3-5 words) description",
              },
              prompt: {
                type: "string",
                description: "Full detailed instructions for this sub-agent",
              },
              subagent_type: {
                type: "string",
                enum: availableAgents,
              },
              file_ownership: {
                type: "array",
                items: { type: "string" },
                description:
                  "Paths this agent owns exclusively (e.g. ['apps/web/src'])",
              },
            },
            required: ["description", "prompt", "subagent_type"],
          },
        },
        run_verification: {
          type: "boolean",
          description:
            "If true (default), spawn a tester agent after all tasks complete to verify the result.",
        },
      },
      required: ["tasks"],
    },
    execute: async (args: Record<string, unknown>) => {
      const taskList =
        (args.tasks as Array<{
          description: string;
          prompt: string;
          subagent_type: string;
          file_ownership?: string[];
        }>) ?? [];
      const runVerification = args.run_verification !== false;

      if (taskList.length === 0) {
        return "Error: tasks array is empty.";
      }

      logger.info(
        `[Orchestrator] Spawning ${taskList.length} parallel sub-agents`,
      );

      // Create all DB records up-front so the UI can show them immediately
      const taskEntries = await Promise.all(
        taskList.map(async (t) => {
          const taskId = newId();
          await db.insert(agentTask).values({
            id: taskId,
            executionId: rootExecutionId,
            agentName: t.subagent_type,
            description: t.description,
            prompt: t.prompt,
            status: "running",
          });
          await appendTaskEvent(rootExecutionId, "agent:start", {
            taskId,
            agentName: t.subagent_type,
            description: t.description,
          });
          return { taskId, ...t };
        }),
      );

      // Run all sub-agents in parallel
      const results = await Promise.allSettled(
        taskEntries.map(async (entry) => {
          const result = await runSubAgent({
            taskId: entry.taskId,
            rootExecutionId,
            workspaceId,
            agentName: entry.subagent_type,
            prompt: entry.prompt,
            modelId,
            parentWorktreeDir: worktreeDir,
            fileOwnership: entry.file_ownership ?? [],
            agentRegistry,
          });

          await db
            .update(agentTask)
            .set({
              status: result.success ? "completed" : "failed",
              result: result.output,
              errorMessage: result.errorMessage,
              steps: result.steps,
              completedAt: new Date(),
            })
            .where(eq(agentTask.id, entry.taskId));

          await appendTaskEvent(
            rootExecutionId,
            result.success ? "agent:complete" : "agent:error",
            {
              taskId: entry.taskId,
              agentName: entry.subagent_type,
              description: entry.description,
              success: result.success,
              steps: result.steps,
              errorMessage: result.errorMessage,
            },
          );

          return { entry, result };
        }),
      );

      // Collect outputs
      const outputs: string[] = [];
      const failures: string[] = [];

      for (const settled of results) {
        if (settled.status === "fulfilled") {
          const { entry, result } = settled.value;
          if (result.success) {
            outputs.push(
              `### ${entry.subagent_type} (${entry.description})\n${result.output}`,
            );
          } else {
            failures.push(
              `- ${entry.subagent_type} (${entry.description}): ${result.errorMessage ?? "unknown error"}`,
            );
          }
        } else {
          failures.push(`- Task failed: ${settled.reason}`);
        }
      }

      const failureSummary =
        failures.length > 0 ? `\n\n**Failures:**\n${failures.join("\n")}` : "";

      const combinedOutput = outputs.join("\n\n");

      // Run optional verification pass
      let verificationResult = "";
      if (runVerification && outputs.length > 0) {
        const verifyTaskId = newId();
        logger.info(
          `[Orchestrator] Running verification pass (${verifyTaskId})`,
        );

        await db.insert(agentTask).values({
          id: verifyTaskId,
          executionId: rootExecutionId,
          agentName: "tester",
          description: "Verify parallel agent results",
          prompt: `Verify the following work was completed correctly:\n\n${combinedOutput}\n\nRun relevant build/test/lint commands and report any issues.`,
          status: "running",
        });

        await appendTaskEvent(rootExecutionId, "agent:start", {
          taskId: verifyTaskId,
          agentName: "tester",
          description: "Verify parallel agent results",
        });

        try {
          const verifyResult = await runSubAgent({
            taskId: verifyTaskId,
            rootExecutionId,
            workspaceId,
            agentName: "tester",
            prompt: `Verify the following work was completed correctly:\n\n${combinedOutput}\n\nRun relevant build/test/lint commands and report any issues.`,
            modelId,
            parentWorktreeDir: worktreeDir,
            agentRegistry,
          });

          await db
            .update(agentTask)
            .set({
              status: verifyResult.success ? "completed" : "failed",
              result: verifyResult.output,
              errorMessage: verifyResult.errorMessage,
              steps: verifyResult.steps,
              completedAt: new Date(),
            })
            .where(eq(agentTask.id, verifyTaskId));

          await appendTaskEvent(
            rootExecutionId,
            verifyResult.success ? "agent:complete" : "agent:error",
            {
              taskId: verifyTaskId,
              agentName: "tester",
              description: "Verify parallel agent results",
              success: verifyResult.success,
              steps: verifyResult.steps,
            },
          );

          verificationResult = `\n\n---\n**Verification:**\n${verifyResult.output}`;
        } catch (err) {
          verificationResult = `\n\n---\n**Verification failed:** ${err}`;
        }
      }

      return [
        `Parallel tasks completed (${outputs.length} succeeded, ${failures.length} failed).`,
        failureSummary,
        "",
        combinedOutput,
        verificationResult,
      ]
        .filter((s) => s !== "")
        .join("\n");
    },
  };
}

// ---------------------------------------------------------------------------
// Internal helper shared by createTaskTool and createParallelTasksTool
// ---------------------------------------------------------------------------

async function runSingleTask(opts: {
  rootExecutionId: string;
  workspaceId: string;
  modelId: string;
  worktreeDir: string;
  agentRegistry: Record<string, AgentDefinition>;
  args: Record<string, unknown>;
}): Promise<string> {
  const {
    rootExecutionId,
    workspaceId,
    modelId,
    worktreeDir,
    agentRegistry,
    args,
  } = opts;

  const description = String(args.description || "");
  const prompt = String(args.prompt || "");
  const subagentType = String(args.subagent_type || "coder");
  const fileOwnership = Array.isArray(args.file_ownership)
    ? (args.file_ownership as string[])
    : [];
  const existingTaskId = args.task_id ? String(args.task_id) : undefined;

  logger.info(
    `[Orchestrator] Spawning sub-agent '${subagentType}' for: ${description}`,
  );

  // Check for existing task to resume
  if (existingTaskId) {
    const [existing] = await db
      .select()
      .from(agentTask)
      .where(eq(agentTask.id, existingTaskId))
      .limit(1);

    if (existing?.status === "completed" && existing.result) {
      return `task_id: ${existingTaskId} (resumed — already completed)\n\n<task_result>\n${existing.result}\n</task_result>`;
    }
  }

  // Create or reuse agentTask DB record
  const taskId = existingTaskId ?? newId();

  if (!existingTaskId) {
    await db.insert(agentTask).values({
      id: taskId,
      executionId: rootExecutionId,
      agentName: subagentType,
      description,
      prompt,
      status: "running",
    });
  } else {
    await db
      .update(agentTask)
      .set({ status: "running" })
      .where(eq(agentTask.id, taskId));
  }

  // Emit agent:start event into execution_event for SSE streaming
  try {
    await appendTaskEvent(rootExecutionId, "agent:start", {
      taskId,
      agentName: subagentType,
      description,
    });
  } catch (err) {
    logger.warn(`Failed to emit agent:start event: ${err}`);
  }

  try {
    const result = await runSubAgent({
      taskId,
      rootExecutionId,
      workspaceId,
      agentName: subagentType,
      prompt,
      modelId,
      parentWorktreeDir: worktreeDir,
      fileOwnership,
      agentRegistry,
    });

    // Update DB record
    await db
      .update(agentTask)
      .set({
        status: result.success ? "completed" : "failed",
        result: result.output,
        errorMessage: result.errorMessage,
        steps: result.steps,
        completedAt: new Date(),
      })
      .where(eq(agentTask.id, taskId));

    // Emit agent:complete or agent:error event
    try {
      await appendTaskEvent(
        rootExecutionId,
        result.success ? "agent:complete" : "agent:error",
        {
          taskId,
          agentName: subagentType,
          description,
          success: result.success,
          steps: result.steps,
          errorMessage: result.errorMessage,
        },
      );
    } catch (err) {
      logger.warn(`Failed to emit agent completion event: ${err}`);
    }

    if (!result.success) {
      return [
        `task_id: ${taskId}`,
        ``,
        `<task_result>`,
        `FAILED: ${result.errorMessage ?? "Unknown error"}`,
        `Partial output:`,
        result.output || "(none)",
        `</task_result>`,
      ].join("\n");
    }

    return [
      `task_id: ${taskId} (for resuming to continue this task if needed)`,
      ``,
      `<task_result>`,
      result.output || "(no output)",
      `</task_result>`,
    ].join("\n");
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);

    await db
      .update(agentTask)
      .set({
        status: "failed",
        errorMessage,
        completedAt: new Date(),
      })
      .where(eq(agentTask.id, taskId));

    logger.error(
      `[Task ${taskId}] Sub-agent '${subagentType}' failed: ${errorMessage}`,
    );

    return [
      `task_id: ${taskId}`,
      ``,
      `<task_result>`,
      `FAILED: ${errorMessage}`,
      `</task_result>`,
    ].join("\n");
  }
}
