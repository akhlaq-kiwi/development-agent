import type { AgentAdapter, AgentRunRequest, AgentRunResult } from "../types.js";
/** Wraps the Claude Code CLI in headless/print mode. */
export declare class ClaudeAdapter implements AgentAdapter {
    readonly kind: "claude";
    run(req: AgentRunRequest): Promise<AgentRunResult>;
}
