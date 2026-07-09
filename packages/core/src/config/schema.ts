import { z } from "zod";

export const AgentConfigSchema = z.object({
  kind: z.enum(["claude", "antigravity"]).default("claude"),
  timeout: z.string().default("20m"),
});

export const GitHubProviderConfigSchema = z.object({
  kind: z.literal("github"),
  repository: z.string(), // owner/repo
  patEnvVar: z.string().default("GITHUB_PAT"),
  issueLabel: z.string().default("antigravity"),
  baseBranch: z.string().default("main"),
});

export const JiraProviderConfigSchema = z.object({
  kind: z.literal("jira"),
  baseUrl: z.string(),
  projectKey: z.string(),
  email: z.string(),
  patEnvVar: z.string().default("JIRA_PAT"),
  jqlFilter: z.string().optional(),
});

export const AzureDevOpsProviderConfigSchema = z.object({
  kind: z.literal("azure-devops"),
  organization: z.string(),
  project: z.string(),
  patEnvVar: z.string().default("AZURE_DEVOPS_PAT"),
  areaPath: z.string().optional(),
});

export const ProviderConfigSchema = z.discriminatedUnion("kind", [
  GitHubProviderConfigSchema,
  JiraProviderConfigSchema,
  AzureDevOpsProviderConfigSchema,
]);

export const DeployConfigSchema = z.object({
  enabled: z.boolean().default(false),
  createPr: z.boolean().default(true),
});

export const BuilderConfigSchema = z.object({
  agent: AgentConfigSchema.default({ kind: "claude", timeout: "20m" }),
  provider: ProviderConfigSchema.optional(),
  deploy: DeployConfigSchema.default({ enabled: false, createPr: true }),
  projectDir: z.string().optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type BuilderConfig = z.infer<typeof BuilderConfigSchema>;
