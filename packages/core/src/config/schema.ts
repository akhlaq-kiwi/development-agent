import { z } from "zod";

export const AgentConfigSchema = z.object({
  kind: z.enum(["claude", "antigravity"]).default("claude"),
});

export const GitHubProviderConfigSchema = z.object({
  kind: z.literal("github"),
  repository: z.string(), // owner/repo
  /** Fallback only — the token entered through the config UI (stored in SQLite) takes precedence. */
  patEnvVar: z.string().optional(),
  issueLabel: z.string().default("antigravity"),
  baseBranch: z.string().default("main"),
});

export const JiraProviderConfigSchema = z.object({
  kind: z.literal("jira"),
  baseUrl: z.string(),
  projectKey: z.string(),
  email: z.string(),
  patEnvVar: z.string().optional(),
  jqlFilter: z.string().optional(),
});

export const AzureDevOpsProviderConfigSchema = z.object({
  kind: z.literal("azure-devops"),
  organization: z.string(),
  project: z.string(),
  patEnvVar: z.string().optional(),
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

export const ScheduleConfigSchema = z.object({
  /** How long to sleep between polls for new work items, once a run loop is active. */
  pollIntervalSeconds: z.number().int().positive().default(300),
});

export const BuilderConfigSchema = z.object({
  agent: AgentConfigSchema.default({ kind: "claude" }),
  provider: ProviderConfigSchema.optional(),
  deploy: DeployConfigSchema.default({ enabled: false, createPr: true }),
  schedule: ScheduleConfigSchema.default({ pollIntervalSeconds: 300 }),
  projectDir: z.string().optional(),
});

export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type ScheduleConfig = z.infer<typeof ScheduleConfigSchema>;
export type BuilderConfig = z.infer<typeof BuilderConfigSchema>;
