import { GitHubProvider } from "./github.js";
import { JiraProvider } from "./jira.js";
import { AzureDevOpsProvider } from "./azure-devops.js";
export function createProvider(config) {
    switch (config.kind) {
        case "github":
            return new GitHubProvider(config);
        case "jira":
            return new JiraProvider(config);
        case "azure-devops":
            return new AzureDevOpsProvider(config);
    }
}
export { GitHubProvider, JiraProvider, AzureDevOpsProvider };
