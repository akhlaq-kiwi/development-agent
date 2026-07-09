import type { IssueProvider } from "../types.js";
import type { ProviderConfig } from "../config/schema.js";
import { GitHubProvider } from "./github.js";
import { JiraProvider } from "./jira.js";
import { AzureDevOpsProvider } from "./azure-devops.js";
export declare function createProvider(config: ProviderConfig): IssueProvider;
export { GitHubProvider, JiraProvider, AzureDevOpsProvider };
