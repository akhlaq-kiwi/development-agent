import type { IssueProvider, WorkItem } from "../types.js";
import type { AzureDevOpsProviderConfigSchema } from "../config/schema.js";
import { z } from "zod";
type AzureDevOpsConfig = z.infer<typeof AzureDevOpsProviderConfigSchema>;
export declare class AzureDevOpsProvider implements IssueProvider {
    private readonly config;
    readonly kind: "azure-devops";
    private readonly authHeader;
    private readonly apiBase;
    constructor(config: AzureDevOpsConfig);
    private headers;
    listOpenWorkItems(): Promise<WorkItem[]>;
    private setState;
    markInProgress(item: WorkItem): Promise<void>;
    removeInProgress(item: WorkItem): Promise<void>;
    markDone(item: WorkItem): Promise<void>;
}
export {};
