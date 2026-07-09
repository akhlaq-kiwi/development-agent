import type { IssueProvider, WorkItem } from "../types.js";
import type { JiraProviderConfigSchema } from "../config/schema.js";
import { z } from "zod";
type JiraConfig = z.infer<typeof JiraProviderConfigSchema>;
export declare class JiraProvider implements IssueProvider {
    private readonly config;
    readonly kind: "jira";
    private readonly authHeader;
    constructor(config: JiraConfig);
    private headers;
    listOpenWorkItems(): Promise<WorkItem[]>;
    private transition;
    markInProgress(item: WorkItem): Promise<void>;
    removeInProgress(item: WorkItem): Promise<void>;
    markDone(item: WorkItem): Promise<void>;
}
export {};
