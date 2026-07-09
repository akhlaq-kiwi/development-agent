export class JiraProvider {
    config;
    kind = "jira";
    authHeader;
    constructor(config) {
        this.config = config;
        const pat = process.env[config.patEnvVar];
        if (!pat)
            throw new Error(`Missing Jira API token: env var ${config.patEnvVar} is not set`);
        this.authHeader = `Basic ${Buffer.from(`${config.email}:${pat}`).toString("base64")}`;
    }
    headers() {
        return { Authorization: this.authHeader, Accept: "application/json", "Content-Type": "application/json" };
    }
    async listOpenWorkItems() {
        const jql = this.config.jqlFilter ??
            `project = ${this.config.projectKey} AND statusCategory != Done ORDER BY created ASC`;
        const url = `${this.config.baseUrl}/rest/api/3/search?jql=${encodeURIComponent(jql)}&maxResults=100`;
        const res = await fetch(url, { headers: this.headers() });
        if (!res.ok)
            throw new Error(`Jira API error ${res.status}: ${await res.text()}`);
        const data = (await res.json());
        return data.issues.map((i) => ({
            id: i.key,
            title: i.fields.summary,
            body: i.fields.description ?? "",
            url: `${this.config.baseUrl}/browse/${i.key}`,
            provider: "jira",
            labels: [],
        }));
    }
    async transition(item, statusName) {
        // Look up the transition id matching statusName, then apply it.
        const transitionsRes = await fetch(`${this.config.baseUrl}/rest/api/3/issue/${item.id}/transitions`, { headers: this.headers() });
        if (!transitionsRes.ok)
            return;
        const { transitions } = (await transitionsRes.json());
        const match = transitions.find((t) => t.name.toLowerCase() === statusName.toLowerCase());
        if (!match)
            return;
        await fetch(`${this.config.baseUrl}/rest/api/3/issue/${item.id}/transitions`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ transition: { id: match.id } }),
        }).catch(() => undefined);
    }
    async markInProgress(item) {
        await this.transition(item, "In Progress");
    }
    async removeInProgress(item) {
        await this.transition(item, "To Do");
    }
    async markDone(item) {
        await this.transition(item, "Done");
    }
}
