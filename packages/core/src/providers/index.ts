import type { IssueProvider } from "../types.js";
import type { ProviderConfig } from "../config/schema.js";
import { GitHubProvider } from "./github.js";
import { JiraProvider } from "./jira.js";
import { AzureDevOpsProvider } from "./azure-devops.js";

/** `token` is the access token entered through the config UI (falls back to config.patEnvVar if set and token is empty). */
export function createProvider(config: ProviderConfig, token: string): IssueProvider {
  const resolvedToken = token || (config.patEnvVar ? process.env[config.patEnvVar] ?? "" : "");
  switch (config.kind) {
    case "github":
      return new GitHubProvider(config, resolvedToken);
    case "jira":
      return new JiraProvider(config, resolvedToken);
    case "azure-devops":
      return new AzureDevOpsProvider(config, resolvedToken);
  }
}

export { GitHubProvider, JiraProvider, AzureDevOpsProvider };
