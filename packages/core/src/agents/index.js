import { ClaudeAdapter } from "./claude.js";
import { AntigravityAdapter } from "./antigravity.js";
export function createAgent(kind) {
    switch (kind) {
        case "claude":
            return new ClaudeAdapter();
        case "antigravity":
            return new AntigravityAdapter();
    }
}
export { ClaudeAdapter, AntigravityAdapter };
