import type { IssueProvider, WorkItem } from "../types.js";
import type { GitHubProviderConfigSchema } from "../config/schema.js";
import { z } from "zod";
type GitHubConfig = z.infer<typeof GitHubProviderConfigSchema>;
export declare class GitHubProvider implements IssueProvider {
    private readonly config;
    readonly kind: "github";
    private readonly repo;
    private readonly pat;
    constructor(config: GitHubConfig);
    private headers;
    listOpenWorkItems(): Promise<WorkItem[]>;
    private addLabel;
    private removeLabel;
    markInProgress(item: WorkItem): Promise<void>;
    removeInProgress(item: WorkItem): Promise<void>;
    markDone(item: WorkItem): Promise<void>;
    createPullRequest(branch: string, base: string, title: string, body: string): Promise<string>;
}
export {};
