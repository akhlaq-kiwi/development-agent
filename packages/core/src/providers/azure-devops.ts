import type { IssueProvider, WorkItem } from "../types.js";
import type { AzureDevOpsProviderConfigSchema } from "../config/schema.js";
import { z } from "zod";

type AzureDevOpsConfig = z.infer<typeof AzureDevOpsProviderConfigSchema>;

interface WorkItemQueryResult {
  workItems: { id: number }[];
}

interface WorkItemDetail {
  id: number;
  fields: {
    "System.Title": string;
    "System.Description"?: string;
    "System.State": string;
  };
}

export class AzureDevOpsProvider implements IssueProvider {
  readonly kind = "azure-devops" as const;
  private readonly authHeader: string;
  private readonly apiBase: string;

  constructor(private readonly config: AzureDevOpsConfig, token: string) {
    if (!token) throw new Error("Missing Azure DevOps access token — enter it in the config form");
    this.authHeader = `Basic ${Buffer.from(`:${token}`).toString("base64")}`;
    this.apiBase = `https://dev.azure.com/${config.organization}/${config.project}/_apis`;
  }

  private headers() {
    return { Authorization: this.authHeader, "Content-Type": "application/json" };
  }

  async listOpenWorkItems(): Promise<WorkItem[]> {
    const areaClause = this.config.areaPath ? ` AND [System.AreaPath] = '${this.config.areaPath}'` : "";
    const wiql = {
      query: `SELECT [System.Id] FROM WorkItems WHERE [System.State] NOT IN ('Done', 'Closed', 'Removed')${areaClause} ORDER BY [System.CreatedDate] ASC`,
    };
    const wiqlRes = await fetch(`${this.apiBase}/wit/wiql?api-version=7.1`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(wiql),
    });
    if (!wiqlRes.ok) throw new Error(`Azure DevOps WIQL error ${wiqlRes.status}: ${await wiqlRes.text()}`);
    const { workItems } = (await wiqlRes.json()) as WorkItemQueryResult;
    if (workItems.length === 0) return [];

    const ids = workItems.map((w) => w.id).join(",");
    const detailsRes = await fetch(
      `${this.apiBase}/wit/workitems?ids=${ids}&api-version=7.1`,
      { headers: this.headers() }
    );
    const { value } = (await detailsRes.json()) as { value: WorkItemDetail[] };
    return value.map((w) => ({
      id: String(w.id),
      title: w.fields["System.Title"],
      body: w.fields["System.Description"] ?? "",
      url: `https://dev.azure.com/${this.config.organization}/${this.config.project}/_workitems/edit/${w.id}`,
      provider: "azure-devops" as const,
      labels: [],
    }));
  }

  private async setState(item: WorkItem, state: string) {
    await fetch(`${this.apiBase}/wit/workitems/${item.id}?api-version=7.1`, {
      method: "PATCH",
      headers: { ...this.headers(), "Content-Type": "application/json-patch+json" },
      body: JSON.stringify([{ op: "add", path: "/fields/System.State", value: state }]),
    }).catch(() => undefined);
  }

  async markInProgress(item: WorkItem): Promise<void> {
    await this.setState(item, "Doing");
  }

  async removeInProgress(item: WorkItem): Promise<void> {
    await this.setState(item, "To Do");
  }

  async markDone(item: WorkItem): Promise<void> {
    await this.setState(item, "Done");
  }
}
