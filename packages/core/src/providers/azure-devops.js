export class AzureDevOpsProvider {
    config;
    kind = "azure-devops";
    authHeader;
    apiBase;
    constructor(config) {
        this.config = config;
        const pat = process.env[config.patEnvVar];
        if (!pat)
            throw new Error(`Missing Azure DevOps PAT: env var ${config.patEnvVar} is not set`);
        this.authHeader = `Basic ${Buffer.from(`:${pat}`).toString("base64")}`;
        this.apiBase = `https://dev.azure.com/${config.organization}/${config.project}/_apis`;
    }
    headers() {
        return { Authorization: this.authHeader, "Content-Type": "application/json" };
    }
    async listOpenWorkItems() {
        const areaClause = this.config.areaPath ? ` AND [System.AreaPath] = '${this.config.areaPath}'` : "";
        const wiql = {
            query: `SELECT [System.Id] FROM WorkItems WHERE [System.State] NOT IN ('Done', 'Closed', 'Removed')${areaClause} ORDER BY [System.CreatedDate] ASC`,
        };
        const wiqlRes = await fetch(`${this.apiBase}/wit/wiql?api-version=7.1`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify(wiql),
        });
        if (!wiqlRes.ok)
            throw new Error(`Azure DevOps WIQL error ${wiqlRes.status}: ${await wiqlRes.text()}`);
        const { workItems } = (await wiqlRes.json());
        if (workItems.length === 0)
            return [];
        const ids = workItems.map((w) => w.id).join(",");
        const detailsRes = await fetch(`${this.apiBase}/wit/workitems?ids=${ids}&api-version=7.1`, { headers: this.headers() });
        const { value } = (await detailsRes.json());
        return value.map((w) => ({
            id: String(w.id),
            title: w.fields["System.Title"],
            body: w.fields["System.Description"] ?? "",
            url: `https://dev.azure.com/${this.config.organization}/${this.config.project}/_workitems/edit/${w.id}`,
            provider: "azure-devops",
            labels: [],
        }));
    }
    async setState(item, state) {
        await fetch(`${this.apiBase}/wit/workitems/${item.id}?api-version=7.1`, {
            method: "PATCH",
            headers: { ...this.headers(), "Content-Type": "application/json-patch+json" },
            body: JSON.stringify([{ op: "add", path: "/fields/System.State", value: state }]),
        }).catch(() => undefined);
    }
    async markInProgress(item) {
        await this.setState(item, "Doing");
    }
    async removeInProgress(item) {
        await this.setState(item, "To Do");
    }
    async markDone(item) {
        await this.setState(item, "Done");
    }
}
