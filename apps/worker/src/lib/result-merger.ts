// ** import utils
import { logger } from "@repo/logs";

// ** import types
import type { GeminiProvider } from "@repo/ai";

export interface AgentResult {
  agentName: string;
  description: string;
  output: string;
  success: boolean;
}

export interface MergedResult {
  summary: string;
  filesChanged: string[];
  nextSteps: string[];
  hasFailures: boolean;
}

const SYSTEM_PROMPT = `You are a result synthesizer for a multi-agent coding assistant.

You receive the outputs from multiple specialized agents that worked in parallel on different parts of a coding task. Your job is to produce a clean, structured final summary for the user.

Respond with ONLY valid JSON matching this schema:
{
  "summary": "A clear 2-4 sentence summary of what was accomplished",
  "filesChanged": ["list of files that were created or modified, one per line"],
  "nextSteps": ["optional: any follow-up actions the user should take"],
  "hasFailures": boolean
}

Be concise. Extract file paths from the agent outputs. Do not invent information not present in the outputs.`;

export async function mergeResults(
  results: AgentResult[],
  ai: GeminiProvider,
): Promise<MergedResult> {
  if (results.length === 0) {
    return {
      summary: "No agents produced output.",
      filesChanged: [],
      nextSteps: [],
      hasFailures: false,
    };
  }

  const hasFailures = results.some((r) => !r.success);

  const resultsText = results
    .map(
      (r, i) =>
        `### Agent ${i + 1}: ${r.agentName} (${r.description})\nStatus: ${r.success ? "SUCCESS" : "FAILED"}\n\n${r.output}`,
    )
    .join("\n\n---\n\n");

  try {
    const response = await ai.chat({
      model: "gemini-2.0-flash",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        {
          role: "user",
          content: `Synthesize these agent results:\n\n${resultsText}`,
        },
      ],
      maxTokens: 1024,
      temperature: 0.1,
    });

    const raw = response.content.trim();

    const jsonText = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();

    const parsed = JSON.parse(jsonText) as MergedResult;

    logger.info(
      `[ResultMerger] Merged ${results.length} results, hasFailures=${hasFailures}`,
    );

    return {
      summary: parsed.summary ?? "",
      filesChanged: parsed.filesChanged ?? [],
      nextSteps: parsed.nextSteps ?? [],
      hasFailures,
    };
  } catch (err) {
    logger.warn(`[ResultMerger] Failed to synthesize results: ${err}`);

    // Fallback: naive concatenation
    const summary = results
      .map(
        (r) =>
          `${r.agentName}: ${r.success ? "completed" : "FAILED — " + r.output.slice(0, 200)}`,
      )
      .join("; ");

    return {
      summary,
      filesChanged: [],
      nextSteps: [],
      hasFailures,
    };
  }
}
