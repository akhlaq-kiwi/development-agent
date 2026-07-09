import { spawn } from "node:child_process";
import type { AgentAdapter, AgentRunRequest, AgentRunResult } from "../types.js";
import { buildPrompt } from "./prompt.js";

/** Wraps the `agy` CLI (Antigravity), mirroring legacy/run_agent.sh. */
export class AntigravityAdapter implements AgentAdapter {
  readonly kind = "antigravity" as const;

  async run(req: AgentRunRequest): Promise<AgentRunResult> {
    const prompt = buildPrompt(req);
    const timeout = req.timeout ?? "20m";
    return new Promise((resolve) => {
      const chunks: string[] = [];
      const child = spawn(
        "agy",
        [
          "--dangerously-skip-permissions",
          "--add-dir",
          req.workspaceDir,
          "--print-timeout",
          timeout,
          "--print",
          prompt,
        ],
        { cwd: req.workspaceDir }
      );
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
