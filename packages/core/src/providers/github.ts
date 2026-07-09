import type { IssueProvider, WorkItem } from "../types.js";
import type { GitHubProviderConfigSchema } from "../config/schema.js";
import { z } from "zod";

type GitHubConfig = z.infer<typeof GitHubProviderConfigSchema>;

interface GitHubIssue {
  number: number;
  title: string;
  body: string | null;
  html_url: string;
  pull_request?: unknown;
}

export class GitHubProvider implements IssueProvider {
  readonly kind = "github" as const;
  private readonly repo: string;
  private readonly pat: string;

  constructor(private readonly config: GitHubConfig) {
    this.repo = config.repository.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
    const pat = process.env[config.patEnvVar];
    if (!pat) throw new Error(`Missing GitHub PAT: env var ${config.patEnvVar} is not set`);
    this.pat = pat;
  }

  private headers() {
    return {
      Authorization: `token ${this.pat}`,
      Accept: "application/vnd.github.v3+json",
    };
  }

  async listOpenWorkItems(): Promise<WorkItem[]> {
    const url = `https://api.github.com/repos/${this.repo}/issues?state=open&labels=${encodeURIComponent(
      this.config.issueLabel
    )}&per_page=100&sort=created&direction=asc`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
    const issues = (await res.json()) as GitHubIssue[];
    return issues
      .filter((i) => !i.pull_request)
      .map((i) => ({
        id: String(i.number),
        title: i.title,
        body: i.body ?? "",
        url: i.html_url,
        provider: "github" as const,
        labels: [this.config.issueLabel],
      }));
  }

  private async addLabel(issueNumber: string, label: string) {
    await fetch(`https://api.github.com/repos/${this.repo}/issues/${issueNumber}/labels`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ labels: [label] }),
    }).catch(() => undefined);
  }

  private async removeLabel(issueNumber: string, label: string) {
    await fetch(
      `https://api.github.com/repos/${this.repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`,
      { method: "DELETE", headers: this.headers() }
    ).catch(() => undefined);
  }

  async markInProgress(item: WorkItem): Promise<void> {
    await this.addLabel(item.id, "inprogress");
  }

  async removeInProgress(item: WorkItem): Promise<void> {
    await this.removeLabel(item.id, "inprogress");
  }

  async markDone(item: WorkItem): Promise<void> {
    await this.removeLabel(item.id, this.config.issueLabel);
    await this.removeLabel(item.id, "inprogress");
    await this.addLabel(item.id, "qa");
  }

  async createPullRequest(branch: string, base: string, title: string, body: string): Promise<string> {
    const res = await fetch(`https://api.github.com/repos/${this.repo}/pulls`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ title, head: branch, base, body }),
    });
    const data = (await res.json()) as { html_url?: string; message?: string };
    if (data.html_url) return data.html_url;
    if (data.message?.includes("A pull request already exists")) return "";
    throw new Error(`Failed to create PR: ${data.message ?? "unknown error"}`);
  }
}
