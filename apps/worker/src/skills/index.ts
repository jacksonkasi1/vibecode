/**
 * Skills Registry
 *
 * Skills are named, composable bundles of tools. They provide a higher-level
 * abstraction over raw tools so agents and the orchestrator can request
 * capabilities by semantic name instead of individual tool instances.
 *
 * Each skill has:
 *  - name: unique identifier
 *  - description: what the skill enables
 *  - tools: factory function that produces the actual ExecutableTool instances
 */

// ** import types
import type { ExecutableTool } from "../tools";

// ** import tools
import { createReadFileTool } from "../tools/read-file";
import { createWriteFileTool } from "../tools/write-file";
import { createExecuteCommandTool } from "../tools/execute-command";
import { createListFilesTool } from "../tools/list-files";
import { createSearchCodeTool } from "../tools/search-code";
import { createGitActionsTool } from "../tools/git-actions";

// ---------------------------------------------------------------------------
// Skill definition types
// ---------------------------------------------------------------------------

export interface SkillDefinition {
  name: string;
  description: string;
  /** Produces the tools for this skill given a workspace directory. */
  tools: (workspaceDir: string) => ExecutableTool[];
}

// ---------------------------------------------------------------------------
// Built-in skills
// ---------------------------------------------------------------------------

const filesystemSkill: SkillDefinition = {
  name: "filesystem",
  description:
    "Read and write files in the workspace. Includes directory listing and safe path resolution.",
  tools: (workspaceDir) => [
    createListFilesTool(workspaceDir),
    createReadFileTool(workspaceDir),
    createWriteFileTool(workspaceDir),
  ],
};

const shellSkill: SkillDefinition = {
  name: "shell",
  description:
    "Execute shell commands inside the workspace sandbox (build, lint, test, install).",
  tools: (workspaceDir) => [createExecuteCommandTool(workspaceDir)],
};

const gitSkill: SkillDefinition = {
  name: "git",
  description:
    "Run git operations: status, diff, add, commit, log, branch, stash.",
  tools: (workspaceDir) => createGitActionsTool(workspaceDir),
};

const repoSearchSkill: SkillDefinition = {
  name: "repo-search",
  description:
    "Search the repository for code patterns using ripgrep. Returns matching file paths and line numbers.",
  tools: (workspaceDir) => [createSearchCodeTool(workspaceDir)],
};

const verificationSkill: SkillDefinition = {
  name: "verification",
  description:
    "Verify implementation correctness: run builds, type-checks, linters, and tests.",
  tools: (workspaceDir) => [
    createExecuteCommandTool(workspaceDir),
    createReadFileTool(workspaceDir),
    createListFilesTool(workspaceDir),
  ],
};

// ---------------------------------------------------------------------------
// Registry
// ---------------------------------------------------------------------------

const SKILLS: Record<string, SkillDefinition> = {
  filesystem: filesystemSkill,
  shell: shellSkill,
  git: gitSkill,
  "repo-search": repoSearchSkill,
  verification: verificationSkill,
};

/**
 * Return a skill definition by name.
 */
export function getSkill(name: string): SkillDefinition | undefined {
  return SKILLS[name];
}

/**
 * Return all registered skill definitions.
 */
export function listSkills(): SkillDefinition[] {
  return Object.values(SKILLS);
}

/**
 * Return the tools for one or more skill names, deduplicated by tool name.
 */
export function getSkillTools(
  skillNames: string[],
  workspaceDir: string,
): ExecutableTool[] {
  const seen = new Set<string>();
  const tools: ExecutableTool[] = [];

  for (const name of skillNames) {
    const skill = SKILLS[name];
    if (!skill) continue;
    for (const tool of skill.tools(workspaceDir)) {
      if (!seen.has(tool.name)) {
        seen.add(tool.name);
        tools.push(tool);
      }
    }
  }

  return tools;
}

/**
 * Convenience: return all tools from all skills (full capability set).
 */
export function getAllSkillTools(workspaceDir: string): ExecutableTool[] {
  return getSkillTools(Object.keys(SKILLS), workspaceDir);
}
