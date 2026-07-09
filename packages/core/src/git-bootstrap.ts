import { existsSync, mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { simpleGit } from "simple-git";
import type { BuilderConfig } from "./config/schema.js";

export interface BootstrapResult {
  action: "none" | "cloned" | "initialized";
  message: string;
}

/**
 * Ensures `projectDir` is a usable git repository before the orchestrator starts working in it.
 * - Already a repo: no-op.
 * - GitHub provider + empty/missing dir: clone the configured repository (using the stored token
 *   for auth over HTTPS, so private repos work without any separate git credential setup).
 * - Jira/Azure DevOps (no known git remote) + empty/missing dir: `git init` + an initial commit,
 *   matching the legacy main_agent.sh bootstrap behavior.
 * - Non-empty dir that isn't already a repo: refuses — ambiguous what the user intended.
 */
export async function ensureRepoReady(
  projectDir: string,
  config: BuilderConfig,
  token: string
): Promise<BootstrapResult> {
  const gitDir = join(projectDir, ".git");
  if (existsSync(gitDir)) {
    return { action: "none", message: "Repository already initialized" };
  }

  mkdirSync(projectDir, { recursive: true });
  const entries = readdirSync(projectDir);

  if (config.provider?.kind === "github") {
    if (entries.length > 0) {
      throw new Error(
        `${projectDir} is not a git repository and is not empty — point the project at an empty directory or an existing clone`
      );
    }
    const repo = config.provider.repository.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
    const remoteUrl = token ? `https://${token}@github.com/${repo}.git` : `https://github.com/${repo}.git`;
    await simpleGit().clone(remoteUrl, projectDir);
    return { action: "cloned", message: `Cloned ${repo} into ${projectDir}` };
  }

  // No git-hosting provider configured (Jira/Azure DevOps track issues, not code) —
  // bootstrap a local repo the same way the legacy bash orchestrator did.
  const git = simpleGit(projectDir);
  await git.init();
  const baseBranch = "main";
  await git.checkoutLocalBranch(baseBranch).catch(() => undefined);
  if (entries.length === 0) {
    writeFileSync(join(projectDir, "README.md"), "# Project\n");
    await git.add("README.md");
    await git.commit("Initial commit");
  }
  return { action: "initialized", message: `Initialized a new local git repository at ${projectDir}` };
}
