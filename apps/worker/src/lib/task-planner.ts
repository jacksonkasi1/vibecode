// ** import utils
import { logger } from "@repo/logs";

// ** import types
import type { GeminiProvider } from "@repo/ai";

export interface SubTask {
  description: string;
  prompt: string;
  agentName:
    | "coder"
    | "frontend"
    | "backend"
    | "tester"
    | "researcher"
    | "debugger";
  fileOwnership: string[];
}

export interface TaskPlan {
  /** True when the task is simple enough for a single agent; skip parallel spawning. */
  isSingleAgent: boolean;
  /** The agent to use when isSingleAgent is true. */
  singleAgentType?: SubTask["agentName"];
  /** Parallel sub-tasks — populated when isSingleAgent is false. */
  tasks: SubTask[];
}

const SYSTEM_PROMPT = `You are a task planner for a multi-agent coding assistant.

Given a user's coding task, decompose it into parallel sub-tasks and assign each task to the most appropriate specialist agent.

Rules:
1. If the task is simple (single file change, single domain), return isSingleAgent: true with singleAgentType set.
2. If the task spans multiple domains (e.g. frontend + backend), return parallel sub-tasks.
3. Each sub-task must have exclusive fileOwnership paths to prevent conflicts.
4. Use relative paths from the project root in fileOwnership (e.g. "apps/web/src", "apps/server/src").
5. Never assign overlapping fileOwnership between parallel tasks.
6. Always include a clear, self-contained prompt for each sub-task.

Available agent types:
- frontend: React/TypeScript/Tailwind UI changes (owns apps/web/)
- backend: Hono API routes, Drizzle ORM, server logic (owns apps/server/, packages/db/)
- coder: general coding, monorepo config, packages (owns anything else)
- researcher: read-only analysis (no file ownership needed)
- debugger: bug fixes in a specific area
- tester: writing and running tests

Respond with ONLY valid JSON matching this schema:
{
  "isSingleAgent": boolean,
  "singleAgentType": "coder" | "frontend" | "backend" | "tester" | "researcher" | "debugger" | null,
  "tasks": [
    {
      "description": "short 3-5 word title",
      "prompt": "full detailed instructions",
      "agentName": "frontend" | "backend" | "coder" | ...,
      "fileOwnership": ["apps/web/src", ...]
    }
  ]
}`;

export async function planTask(
  userPrompt: string,
  ai: GeminiProvider,
): Promise<TaskPlan> {
  try {
    const response = await ai.chat({
      model: "gemini-2.0-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Plan this task:\n\n${userPrompt}`,
        },
      ],
      maxTokens: 2048,
      temperature: 0.1,
    });

    const raw = response.content.trim();

    // Strip markdown code fences if present
    const jsonText = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(jsonText) as TaskPlan;

    // Validate shape
    if (typeof parsed.isSingleAgent !== "boolean") {
      throw new Error("Missing isSingleAgent field");
    }
    if (
      !parsed.isSingleAgent &&
      (!Array.isArray(parsed.tasks) || parsed.tasks.length === 0)
    ) {
      throw new Error("Multi-agent plan has no tasks");
    }

    logger.info(
      `[TaskPlanner] Plan: isSingleAgent=${parsed.isSingleAgent}, tasks=${parsed.tasks?.length ?? 0}`,
    );

    return parsed;
  } catch (err) {
    logger.warn(
      `[TaskPlanner] Failed to parse plan, falling back to single coder agent: ${err}`,
    );

    // Safe fallback: single coder agent with the original prompt
    return {
      isSingleAgent: true,
      singleAgentType: "coder",
      tasks: [
        {
          description: "Implement task",
          prompt: userPrompt,
          agentName: "coder",
          fileOwnership: [],
        },
      ],
    };
  }
}
