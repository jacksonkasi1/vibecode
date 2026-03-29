// ** import core packages
import { GoogleGenAI } from "@google/genai";

// ** import utils
import { summarizeFileTree } from "./detector";

interface AnalyzeRepositoryInput {
  name: string;
  framework?: string | null;
  language?: string | null;
  packageManager?: string | null;
  filePaths: string[];
  keyFiles: Array<{ path: string; content: string }>;
}

export interface RepositoryAnalysis {
  architectureSummary: string;
  fileStructureSummary: string;
  conventionsSummary: string;
}

function buildFallbackAnalysis(
  input: AnalyzeRepositoryInput,
): RepositoryAnalysis {
  const keyFileList =
    input.keyFiles.map((file) => `- ${file.path}`).join("\n") ||
    "- No key files available";

  return {
    architectureSummary:
      `Project ${input.name} uses ${input.framework ?? "an unknown framework"}` +
      `${input.language ? ` with ${input.language}` : ""}` +
      `${input.packageManager ? ` and ${input.packageManager}` : ""}.`,
    fileStructureSummary: `Key files:\n${keyFileList}\n\nTop-level tree:\n${summarizeFileTree(input.filePaths)}`,
    conventionsSummary: `Important files indicate a ${input.framework ?? "custom"} application with ${input.packageManager ?? "standard"} package management. Review README and config files for deeper conventions.`,
  };
}

export async function analyzeRepository(input: AnalyzeRepositoryInput) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return buildFallbackAnalysis(input);
  }

  const client = new GoogleGenAI({ apiKey });
  const prompt = [
    `You are analyzing a code repository named ${input.name}.`,
    `Framework: ${input.framework ?? "unknown"}`,
    `Language: ${input.language ?? "unknown"}`,
    `Package manager: ${input.packageManager ?? "unknown"}`,
    "Return three short sections with clear labels:",
    "Architecture Summary:",
    "File Structure Summary:",
    "Conventions Summary:",
    "",
    "Repository tree sample:",
    summarizeFileTree(input.filePaths),
    "",
    "Key file excerpts:",
    ...input.keyFiles.flatMap((file) => [
      `FILE: ${file.path}`,
      file.content.slice(0, 3000),
      "",
    ]),
  ].join("\n");

  try {
    const response = await client.models.generateContent({
      model: "gemini-2.0-flash",
      contents: prompt,
    });

    const text = response.text?.trim();
    if (!text) {
      return buildFallbackAnalysis(input);
    }

    const sections = text.split(/\n(?=[A-Z][A-Za-z ]+:)/g);
    const mapped = new Map<string, string>();
    for (const section of sections) {
      const [heading, ...rest] = section.split("\n");
      mapped.set(
        heading.replace(/:$/, "").trim().toLowerCase(),
        rest.join("\n").trim(),
      );
    }

    return {
      architectureSummary:
        mapped.get("architecture summary") ??
        buildFallbackAnalysis(input).architectureSummary,
      fileStructureSummary:
        mapped.get("file structure summary") ??
        buildFallbackAnalysis(input).fileStructureSummary,
      conventionsSummary:
        mapped.get("conventions summary") ??
        buildFallbackAnalysis(input).conventionsSummary,
    } satisfies RepositoryAnalysis;
  } catch {
    return buildFallbackAnalysis(input);
  }
}
