import type { IssueProvider, WorkItem } from "../types.js";
import type { JiraProviderConfigSchema } from "../config/schema.js";
import { z } from "zod";

type JiraConfig = z.infer<typeof JiraProviderConfigSchema>;

interface JiraIssue {
  key: string;
  fields: { summary: string; description?: string | null };
}

export class JiraProvider implements IssueProvider {
  readonly kind = "jira" as const;
  private readonly authHeader: string;

  constructor(private readonly config: JiraConfig, token: string) {
    if (!token) throw new Error("Missing Jira API token — enter it in the config form");
    this.authHeader = `Basic ${Buffer.from(`${config.email}:${token}`).toString("base64")}`;
  }

  private headers() {
    return { Authorization: this.authHeader, Accept: "application/json", "Content-Type": "application/json" };
  }

  async listOpenWorkItems(): Promise<WorkItem[]> {
    const jql =
      this.config.jqlFilter ??
      `project = ${this.config.projectKey} AND statusCategory != Done ORDER BY created ASC`;
    const url = `${this.config.baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=100`;
    const res = await fetch(url, { headers: this.headers() });
    if (!res.ok) throw new Error(`Jira API error ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { issues: JiraIssue[] };
    return data.issues.map((i) => ({
      id: i.key,
      title: i.fields.summary,
      body: i.fields.description ?? "",
      url: `${this.config.baseUrl}/browse/${i.key}`,
      provider: "jira" as const,
      labels: [],
    }));
  }

  private async transition(item: WorkItem, statusName: string) {
    // Look up the transition id matching statusName, then apply it.
    const transitionsRes = await fetch(
      `${this.config.baseUrl}/rest/api/3/issue/${item.id}/transitions`,
      { headers: this.headers() }
    );
    if (!transitionsRes.ok) return;
    const { transitions } = (await transitionsRes.json()) as {
      transitions: { id: string; name: string }[];
    };
    const match = transitions.find((t) => t.name.toLowerCase() === statusName.toLowerCase());
    if (!match) return;
    await fetch(`${this.config.baseUrl}/rest/api/3/issue/${item.id}/transitions`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ transition: { id: match.id } }),
    }).catch(() => undefined);
  }

  async markInProgress(item: WorkItem): Promise<void> {
    await this.transition(item, "In Progress");
  }

  async removeInProgress(item: WorkItem): Promise<void> {
    await this.transition(item, "To Do");
  }

  async markDone(item: WorkItem): Promise<void> {
    await this.transition(item, "Done");
  }
}
