// ** import core packages
import { GoogleGenAI } from "@google/genai";

// ** import intelligence
import type { ClassificationResult } from "./classifier";

function buildFallbackAnswer(input: {
  classification: ClassificationResult;
  message: string;
  context: Awaited<
    ReturnType<typeof import("./context").assembleIntelligenceContext>
  >;
}) {
  if (input.classification.intent === "status_query") {
    if (input.context.projectKnowledge) {
      return [
        `Project status for ${input.context.projectKnowledge.repositoryName ?? input.context.projectKnowledge.projectId}:`,
        `- Framework: ${input.context.projectKnowledge.framework ?? "unknown"}`,
        `- Language: ${input.context.projectKnowledge.language ?? "unknown"}`,
        `- Last scanned commit: ${input.context.projectKnowledge.lastScannedCommit ?? "unknown"}`,
        `- Pending continuations: ${input.context.continuations.length}`,
      ].join("\n");
    }

    return `I found ${input.context.projects.length} projects, but I do not have scanned knowledge for the requested project yet.`;
  }

  if (input.classification.intent === "cross_project_search") {
    if (!input.context.vectorMatches.length) {
      return "No matching project knowledge found yet. Scan the target projects first so semantic search has material to work with.";
    }

    return input.context.vectorMatches
      .map((match, index) => {
        const metadata = match.metadata as
          | Record<string, string | number | undefined>
          | undefined;
        return `${index + 1}. ${metadata?.projectId ?? "unknown project"} — ${metadata?.summary ?? "no summary"}`;
      })
      .join("\n");
  }

  if (input.context.projectKnowledge) {
    return [
      input.context.projectKnowledge.architectureSummary,
      "",
      input.context.projectKnowledge.conventionsSummary,
    ].join("\n");
  }

  return "I do not have enough project knowledge yet. Run a project scan first.";
}

export async function generateIntelligenceResponse(input: {
  classification: ClassificationResult;
  message: string;
  context: Awaited<
    ReturnType<typeof import("./context").assembleIntelligenceContext>
  >;
}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return buildFallbackAnswer(input);
  }

  const client = new GoogleGenAI({ apiKey });
  const prompt = [
    `Intent: ${input.classification.intent}`,
    `User question: ${input.message}`,
    `Project knowledge: ${JSON.stringify(input.context.projectKnowledge ?? null)}`,
    `Recent executions: ${JSON.stringify(input.context.recentExecutions)}`,
    `Continuations: ${JSON.stringify(input.context.continuations)}`,
    `Vector matches: ${JSON.stringify(input.context.vectorMatches)}`,
    "Answer concisely as a senior engineering lead. Mention if the answer comes from cached project knowledge.",
  ].join("\n\n");

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    return response.text?.trim() || buildFallbackAnswer(input);
  } catch {
    return buildFallbackAnswer(input);
  }
}
