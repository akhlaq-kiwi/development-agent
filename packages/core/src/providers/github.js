export class GitHubProvider {
    config;
    kind = "github";
    repo;
    pat;
    constructor(config) {
        this.config = config;
        this.repo = config.repository.replace(/^https?:\/\/github\.com\//, "").replace(/\.git$/, "");
        const pat = process.env[config.patEnvVar];
        if (!pat)
            throw new Error(`Missing GitHub PAT: env var ${config.patEnvVar} is not set`);
        this.pat = pat;
    }
    headers() {
        return {
            Authorization: `token ${this.pat}`,
            Accept: "application/vnd.github.v3+json",
        };
    }
    async listOpenWorkItems() {
        const url = `https://api.github.com/repos/${this.repo}/issues?state=open&labels=${encodeURIComponent(this.config.issueLabel)}&per_page=100&sort=created&direction=asc`;
        const res = await fetch(url, { headers: this.headers() });
        if (!res.ok)
            throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
        const issues = (await res.json());
        return issues
            .filter((i) => !i.pull_request)
            .map((i) => ({
            id: String(i.number),
            title: i.title,
            body: i.body ?? "",
            url: i.html_url,
            provider: "github",
            labels: [this.config.issueLabel],
        }));
    }
    async addLabel(issueNumber, label) {
        await fetch(`https://api.github.com/repos/${this.repo}/issues/${issueNumber}/labels`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ labels: [label] }),
        }).catch(() => undefined);
    }
    async removeLabel(issueNumber, label) {
        await fetch(`https://api.github.com/repos/${this.repo}/issues/${issueNumber}/labels/${encodeURIComponent(label)}`, { method: "DELETE", headers: this.headers() }).catch(() => undefined);
    }
    async markInProgress(item) {
        await this.addLabel(item.id, "inprogress");
    }
    async removeInProgress(item) {
        await this.removeLabel(item.id, "inprogress");
    }
    async markDone(item) {
        await this.removeLabel(item.id, this.config.issueLabel);
        await this.removeLabel(item.id, "inprogress");
        await this.addLabel(item.id, "qa");
    }
    async createPullRequest(branch, base, title, body) {
        const res = await fetch(`https://api.github.com/repos/${this.repo}/pulls`, {
            method: "POST",
            headers: this.headers(),
            body: JSON.stringify({ title, head: branch, base, body }),
        });
        const data = (await res.json());
        if (data.html_url)
            return data.html_url;
        if (data.message?.includes("A pull request already exists"))
            return "";
        throw new Error(`Failed to create PR: ${data.message ?? "unknown error"}`);
    }
}
