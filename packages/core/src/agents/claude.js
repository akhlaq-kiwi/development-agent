import { spawn } from "node:child_process";
import { buildPrompt } from "./prompt.js";
/** Wraps the Claude Code CLI in headless/print mode. */
export class ClaudeAdapter {
    kind = "claude";
    async run(req) {
        const prompt = buildPrompt(req);
        return new Promise((resolve) => {
            const chunks = [];
            const child = spawn("claude", ["-p", prompt, "--permission-mode", "bypassPermissions", "--add-dir", req.workspaceDir], { cwd: req.workspaceDir });
            child.stdout.on("data", (d) => chunks.push(d.toString()));
            child.stderr.on("data", (d) => chunks.push(d.toString()));
            child.on("close", (code) => {
                resolve({ success: code === 0, exitCode: code ?? 1, log: chunks.join("") });
            });
            child.on("error", (err) => {
                resolve({ success: false, exitCode: 1, log: String(err) });
            });
        });
    }
}
