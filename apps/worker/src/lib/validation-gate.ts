// ** import core packages
import { readFile } from "node:fs/promises";
import path from "node:path";
import { exec } from "node:child_process";
import { promisify } from "node:util";

const execAsync = promisify(exec);

export interface ValidationResult {
  passed: boolean;
  executed: string[];
  failures: Array<{ name: string; command: string; message: string }>;
}

async function runCommand(command: string, cwd: string) {
  try {
    const result = await execAsync(command, { cwd, timeout: 120000 });
    return { ok: true as const, message: result.stdout || "" };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false as const, message };
  }
}

async function readPackageScripts(worktreeDir: string) {
  try {
    const packageJsonPath = path.join(worktreeDir, "package.json");
    const raw = await readFile(packageJsonPath, "utf8");
    const parsed = JSON.parse(raw) as { scripts?: Record<string, string> };
    return parsed.scripts ?? {};
  } catch {
    return {};
  }
}

export async function runValidationGate(
  worktreeDir: string,
): Promise<ValidationResult> {
  const scripts = await readPackageScripts(worktreeDir);
  const candidates: Array<{ name: string; command: string }> = [];

  if (scripts["check-types"]) {
    candidates.push({ name: "check-types", command: "bun run check-types" });
  }

  if (scripts.build) {
    candidates.push({ name: "build", command: "bun run build" });
  }

  const failures: ValidationResult["failures"] = [];
  const executed: string[] = [];

  for (const candidate of candidates) {
    executed.push(candidate.name);
    const firstAttempt = await runCommand(candidate.command, worktreeDir);

    if (!firstAttempt.ok) {
      const secondAttempt = await runCommand(candidate.command, worktreeDir);
      if (secondAttempt.ok) {
        continue;
      }

      failures.push({
        name: candidate.name,
        command: candidate.command,
        message: secondAttempt.message,
      });
      break;
    }
  }

  return {
    passed: failures.length === 0,
    executed,
    failures,
  };
}
