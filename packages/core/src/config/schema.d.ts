import { z } from "zod";
export declare const AgentConfigSchema: z.ZodObject<{
    kind: z.ZodDefault<z.ZodEnum<["claude", "antigravity"]>>;
    timeout: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "claude" | "antigravity";
    timeout: string;
}, {
    kind?: "claude" | "antigravity" | undefined;
    timeout?: string | undefined;
}>;
export declare const GitHubProviderConfigSchema: z.ZodObject<{
    kind: z.ZodLiteral<"github">;
    repository: z.ZodString;
    patEnvVar: z.ZodDefault<z.ZodString>;
    issueLabel: z.ZodDefault<z.ZodString>;
    baseBranch: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "github";
    repository: string;
    patEnvVar: string;
    issueLabel: string;
    baseBranch: string;
}, {
    kind: "github";
    repository: string;
    patEnvVar?: string | undefined;
    issueLabel?: string | undefined;
    baseBranch?: string | undefined;
}>;
export declare const JiraProviderConfigSchema: z.ZodObject<{
    kind: z.ZodLiteral<"jira">;
    baseUrl: z.ZodString;
    projectKey: z.ZodString;
    email: z.ZodString;
    patEnvVar: z.ZodDefault<z.ZodString>;
    jqlFilter: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "jira";
    patEnvVar: string;
    baseUrl: string;
    projectKey: string;
    email: string;
    jqlFilter?: string | undefined;
}, {
    kind: "jira";
    baseUrl: string;
    projectKey: string;
    email: string;
    patEnvVar?: string | undefined;
    jqlFilter?: string | undefined;
}>;
export declare const AzureDevOpsProviderConfigSchema: z.ZodObject<{
    kind: z.ZodLiteral<"azure-devops">;
    organization: z.ZodString;
    project: z.ZodString;
    patEnvVar: z.ZodDefault<z.ZodString>;
    areaPath: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "azure-devops";
    patEnvVar: string;
    organization: string;
    project: string;
    areaPath?: string | undefined;
}, {
    kind: "azure-devops";
    organization: string;
    project: string;
    patEnvVar?: string | undefined;
    areaPath?: string | undefined;
}>;
export declare const ProviderConfigSchema: z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
    kind: z.ZodLiteral<"github">;
    repository: z.ZodString;
    patEnvVar: z.ZodDefault<z.ZodString>;
    issueLabel: z.ZodDefault<z.ZodString>;
    baseBranch: z.ZodDefault<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "github";
    repository: string;
    patEnvVar: string;
    issueLabel: string;
    baseBranch: string;
}, {
    kind: "github";
    repository: string;
    patEnvVar?: string | undefined;
    issueLabel?: string | undefined;
    baseBranch?: string | undefined;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"jira">;
    baseUrl: z.ZodString;
    projectKey: z.ZodString;
    email: z.ZodString;
    patEnvVar: z.ZodDefault<z.ZodString>;
    jqlFilter: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "jira";
    patEnvVar: string;
    baseUrl: string;
    projectKey: string;
    email: string;
    jqlFilter?: string | undefined;
}, {
    kind: "jira";
    baseUrl: string;
    projectKey: string;
    email: string;
    patEnvVar?: string | undefined;
    jqlFilter?: string | undefined;
}>, z.ZodObject<{
    kind: z.ZodLiteral<"azure-devops">;
    organization: z.ZodString;
    project: z.ZodString;
    patEnvVar: z.ZodDefault<z.ZodString>;
    areaPath: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    kind: "azure-devops";
    patEnvVar: string;
    organization: string;
    project: string;
    areaPath?: string | undefined;
}, {
    kind: "azure-devops";
    organization: string;
    project: string;
    patEnvVar?: string | undefined;
    areaPath?: string | undefined;
}>]>;
export declare const DeployConfigSchema: z.ZodObject<{
    enabled: z.ZodDefault<z.ZodBoolean>;
    createPr: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    enabled: boolean;
    createPr: boolean;
}, {
    enabled?: boolean | undefined;
    createPr?: boolean | undefined;
}>;
export declare const BuilderConfigSchema: z.ZodObject<{
    agent: z.ZodDefault<z.ZodObject<{
        kind: z.ZodDefault<z.ZodEnum<["claude", "antigravity"]>>;
        timeout: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "claude" | "antigravity";
        timeout: string;
    }, {
        kind?: "claude" | "antigravity" | undefined;
        timeout?: string | undefined;
    }>>;
    provider: z.ZodOptional<z.ZodDiscriminatedUnion<"kind", [z.ZodObject<{
        kind: z.ZodLiteral<"github">;
        repository: z.ZodString;
        patEnvVar: z.ZodDefault<z.ZodString>;
        issueLabel: z.ZodDefault<z.ZodString>;
        baseBranch: z.ZodDefault<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "github";
        repository: string;
        patEnvVar: string;
        issueLabel: string;
        baseBranch: string;
    }, {
        kind: "github";
        repository: string;
        patEnvVar?: string | undefined;
        issueLabel?: string | undefined;
        baseBranch?: string | undefined;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"jira">;
        baseUrl: z.ZodString;
        projectKey: z.ZodString;
        email: z.ZodString;
        patEnvVar: z.ZodDefault<z.ZodString>;
        jqlFilter: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "jira";
        patEnvVar: string;
        baseUrl: string;
        projectKey: string;
        email: string;
        jqlFilter?: string | undefined;
    }, {
        kind: "jira";
        baseUrl: string;
        projectKey: string;
        email: string;
        patEnvVar?: string | undefined;
        jqlFilter?: string | undefined;
    }>, z.ZodObject<{
        kind: z.ZodLiteral<"azure-devops">;
        organization: z.ZodString;
        project: z.ZodString;
        patEnvVar: z.ZodDefault<z.ZodString>;
        areaPath: z.ZodOptional<z.ZodString>;
    }, "strip", z.ZodTypeAny, {
        kind: "azure-devops";
        patEnvVar: string;
        organization: string;
        project: string;
        areaPath?: string | undefined;
    }, {
        kind: "azure-devops";
        organization: string;
        project: string;
        patEnvVar?: string | undefined;
        areaPath?: string | undefined;
    }>]>>;
    deploy: z.ZodDefault<z.ZodObject<{
        enabled: z.ZodDefault<z.ZodBoolean>;
        createPr: z.ZodDefault<z.ZodBoolean>;
    }, "strip", z.ZodTypeAny, {
        enabled: boolean;
        createPr: boolean;
    }, {
        enabled?: boolean | undefined;
        createPr?: boolean | undefined;
    }>>;
    projectDir: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    agent: {
        kind: "claude" | "antigravity";
        timeout: string;
    };
    deploy: {
        enabled: boolean;
        createPr: boolean;
    };
    provider?: {
        kind: "github";
        repository: string;
        patEnvVar: string;
        issueLabel: string;
        baseBranch: string;
    } | {
        kind: "jira";
        patEnvVar: string;
        baseUrl: string;
        projectKey: string;
        email: string;
        jqlFilter?: string | undefined;
    } | {
        kind: "azure-devops";
        patEnvVar: string;
        organization: string;
        project: string;
        areaPath?: string | undefined;
    } | undefined;
    projectDir?: string | undefined;
}, {
    agent?: {
        kind?: "claude" | "antigravity" | undefined;
        timeout?: string | undefined;
    } | undefined;
    deploy?: {
        enabled?: boolean | undefined;
        createPr?: boolean | undefined;
    } | undefined;
    provider?: {
        kind: "github";
        repository: string;
        patEnvVar?: string | undefined;
        issueLabel?: string | undefined;
        baseBranch?: string | undefined;
    } | {
        kind: "jira";
        baseUrl: string;
        projectKey: string;
        email: string;
        patEnvVar?: string | undefined;
        jqlFilter?: string | undefined;
    } | {
        kind: "azure-devops";
        organization: string;
        project: string;
        patEnvVar?: string | undefined;
        areaPath?: string | undefined;
    } | undefined;
    projectDir?: string | undefined;
}>;
export type AgentConfig = z.infer<typeof AgentConfigSchema>;
export type ProviderConfig = z.infer<typeof ProviderConfigSchema>;
export type BuilderConfig = z.infer<typeof BuilderConfigSchema>;
