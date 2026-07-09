import type { AgentAdapter, AgentRunRequest, AgentRunResult } from "../types.js";
/** Wraps the `agy` CLI (Antigravity), mirroring legacy/run_agent.sh. */
export declare class AntigravityAdapter implements AgentAdapter {
    readonly kind: "antigravity";
    run(req: AgentRunRequest): Promise<AgentRunResult>;
}
