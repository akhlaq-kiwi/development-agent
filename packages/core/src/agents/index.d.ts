import type { AgentAdapter, AgentKind } from "../types.js";
import { ClaudeAdapter } from "./claude.js";
import { AntigravityAdapter } from "./antigravity.js";
export declare function createAgent(kind: AgentKind): AgentAdapter;
export { ClaudeAdapter, AntigravityAdapter };
