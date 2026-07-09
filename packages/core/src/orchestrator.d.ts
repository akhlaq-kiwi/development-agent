import type { AgentAdapter, IssueProvider, RunEvent, WorkItem } from "./types.js";
import type { BuilderConfig } from "./config/schema.js";
import { StateStore } from "./state/store.js";
export interface OrchestratorOptions {
    config: BuilderConfig;
    provider: IssueProvider;
    agent: AgentAdapter;
    store: StateStore;
    projectDir: string;
    /** Shell command that builds/tests the project; non-zero exit = verification failure. Defaults to legacy/verify.sh. */
    verifyCommand?: string;
    /** Shell command that deploys after a successful merge. Defaults to legacy/deploy.sh. */
    deployCommand?: string;
    onEvent?: (event: RunEvent) => void;
    singleRun?: boolean;
    maxVerifyRetries?: number;
}
/** Ports the main_agent.sh loop: fetch -> branch -> agent -> verify (self-heal) -> commit/PR -> deploy. */
export declare class Orchestrator {
    private readonly opts;
    private readonly git;
    private readonly runId;
    constructor(opts: OrchestratorOptions);
    private emit;
    processOne(item: WorkItem): Promise<boolean>;
    run(): Promise<void>;
}
