// ** import core packages
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import os from "node:os";

// ** import types
import type { AgentDefinition, AgentMode } from "./types";

// ─── Frontmatter parser ───────────────────────────────────────────────────────

interface ParsedFrontmatter {
  name?: string;
  description?: string;
  model?: string;
  mode?: string;
  maxSteps?: number;
}

/**
 * Minimal YAML frontmatter parser.
 * Supports: string fields (`key: value`) and number fields (`key: 42`).
 * Delimiters must be `---` on their own line.
 */
function parseFrontmatter(source: string): {
  data: ParsedFrontmatter;
  body: string;
} {
  const match = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!match) {
    return { data: {}, body: source };
  }

  const yamlBlock = match[1] ?? "";
  const body = (match[2] ?? "").trim();
  const data: ParsedFrontmatter = {};

  for (const line of yamlBlock.split(/\r?\n/)) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    const rawValue = line.slice(colonIdx + 1).trim();

    // Strip optional inline quotes
    const value = rawValue.replace(/^["']|["']$/g, "");

    if (key === "maxSteps") {
      const n = Number(value);
      if (!Number.isNaN(n)) data.maxSteps = n;
    } else if (
      key === "name" ||
      key === "description" ||
      key === "model" ||
      key === "mode"
    ) {
      (data as Record<string, string>)[key] = value;
    }
  }

  return { data, body };
}

// ─── Directory scanner ────────────────────────────────────────────────────────

async function collectMdFiles(dir: string, results: string[]): Promise<void> {
  let names: string[];
  try {
    names = await readdir(dir);
  } catch {
    return;
  }
  for (const name of names) {
    const fullPath = path.join(dir, name);
    const s = await stat(fullPath).catch(() => null);
    if (!s) continue;
    if (s.isDirectory()) {
      await collectMdFiles(fullPath, results);
    } else if (s.isFile() && name.endsWith(".md")) {
      results.push(fullPath);
    }
  }
}

async function scanAgentDir(dir: string): Promise<AgentDefinition[]> {
  const filePaths: string[] = [];
  await collectMdFiles(dir, filePaths);

  const definitions: AgentDefinition[] = [];

  for (const filePath of filePaths) {
    let source: string;
    try {
      source = await readFile(filePath, "utf-8");
    } catch {
      continue;
    }

    const { data, body } = parseFrontmatter(source);

    if (!body) continue; // system prompt is required

    // Agent name: from frontmatter or filename (without .md)
    const agentName =
      data.name?.trim() || path.basename(filePath, ".md").trim();

    if (!agentName) continue;

    const mode: AgentMode =
      data.mode === "primary" || data.mode === "all"
        ? (data.mode as AgentMode)
        : "subagent";

    definitions.push({
      name: agentName,
      description: data.description ?? `User-defined agent: ${agentName}`,
      mode,
      systemPrompt: body,
      maxSteps: data.maxSteps ?? 50,
      model: data.model,
      isUserDefined: true,
    });
  }

  return definitions;
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Load user-defined agents from:
 * 1. `~/.config/vibecode/agents/` (global — lower precedence)
 * 2. `{workspaceDir}/.vibecode/agents/` (workspace-local — higher precedence)
 *
 * Workspace agents override global agents with the same name.
 * Returns an empty array if neither directory exists.
 */
export async function loadUserAgents(
  workspaceDir?: string,
): Promise<AgentDefinition[]> {
  const globalDir = path.join(os.homedir(), ".config", "vibecode", "agents");

  const [globalAgents, workspaceAgents] = await Promise.all([
    scanAgentDir(globalDir),
    workspaceDir
      ? scanAgentDir(path.join(workspaceDir, ".vibecode", "agents"))
      : Promise.resolve([] as AgentDefinition[]),
  ]);

  // Merge: workspace-local wins over global (same name)
  const merged = new Map<string, AgentDefinition>();
  for (const def of globalAgents) {
    merged.set(def.name, def);
  }
  for (const def of workspaceAgents) {
    merged.set(def.name, def);
  }

  return Array.from(merged.values());
}
