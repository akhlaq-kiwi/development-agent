#!/usr/bin/env node
import { Command } from "commander";
import { resolve } from "node:path";
import { ensureDaemon } from "./daemon-client.js";

const program = new Command();
program
  .name("builder")
  .description("Multi-provider, multi-agent issue-to-PR automation")
  .version("0.1.0")
  .option("-p, --project <dir>", "path to the target project (defaults to the current directory)");

function projectDir(): string {
  const opts = program.opts<{ project?: string }>();
  return resolve(opts.project ?? process.cwd());
}

/** CLI convenience: a path maps to a workspace, creating one named after the directory if needed. */
async function resolveWorkspaceId(base: string): Promise<string> {
  const res = await fetch(`${base}/workspaces/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectDir: projectDir() }),
  });
  if (!res.ok) throw new Error(await res.text());
  const ws = (await res.json()) as { id: string };
  return ws.id;
}

program
  .command("home")
  .description("Print the URL of the Projects home page (starts the daemon if needed)")
  .action(async () => {
    const base = await ensureDaemon();
    console.log(base);
  });

program
  .command("configure")
  .description("Print the URL of the config form for the target project (starts the daemon if needed)")
  .action(async () => {
    const base = await ensureDaemon();
    const workspaceId = await resolveWorkspaceId(base);
    console.log(`${base}/config?workspaceId=${encodeURIComponent(workspaceId)}`);
  });

program
  .command("run")
  .description("Start processing open work items in the target project")
  .option("-s, --single", "process a single work item then exit")
  .action(async (opts: { single?: boolean }) => {
    const base = await ensureDaemon();
    const workspaceId = await resolveWorkspaceId(base);
    const res = await fetch(`${base}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, singleRun: Boolean(opts.single) }),
    });
    if (!res.ok) {
      console.error(await res.text());
      process.exit(1);
    }
    console.log("Run started. Use `builder status` or `builder logs` to follow progress.");
  });

program
  .command("status")
  .description("Show current work item queue status")
  .action(async () => {
    const base = await ensureDaemon();
    const workspaceId = await resolveWorkspaceId(base);
    const res = await fetch(`${base}/work-items?workspaceId=${encodeURIComponent(workspaceId)}`);
    const items = (await res.json()) as { id: string; provider: string; title: string; status: string }[];
    if (items.length === 0) {
      console.log("No tracked work items yet.");
      return;
    }
    for (const item of items) {
      console.log(`[${item.status.padEnd(11)}] ${item.provider}#${item.id} ${item.title}`);
    }
  });

program
  .command("logs")
  .description("Show recent orchestration events")
  .option("-n, --lines <count>", "how many recent lines to show", "50")
  .action(async (opts: { lines: string }) => {
    const base = await ensureDaemon();
    const workspaceId = await resolveWorkspaceId(base);
    const res = await fetch(`${base}/events?workspaceId=${encodeURIComponent(workspaceId)}&limit=${opts.lines}`);
    const events = (await res.json()) as { ts: number; stage: string; message: string; level: string }[];
    // Server returns newest-first; print oldest-first so the most recent line ends up at the bottom of the terminal.
    for (const e of events.reverse()) {
      console.log(`${new Date(e.ts).toISOString()} [${e.stage}] ${e.message}`);
    }
  });

program
  .command("open")
  .description(
    "Print the config form URL if the target project isn't configured yet, otherwise the dashboard URL"
  )
  .action(async () => {
    const base = await ensureDaemon();
    const workspaceId = await resolveWorkspaceId(base);
    const res = await fetch(`${base}/config?workspaceId=${encodeURIComponent(workspaceId)}`);
    const config = (await res.json()) as { provider?: unknown; projectDir?: string };
    const path = config.provider && config.projectDir
      ? `/?workspaceId=${encodeURIComponent(workspaceId)}`
      : `/config?workspaceId=${encodeURIComponent(workspaceId)}`;
    console.log(`${base}${path}`);
  });

program
  .command("dashboard")
  .description("Print the URL of the local dashboard for the target project (starts the daemon if needed)")
  .action(async () => {
    const base = await ensureDaemon();
    const workspaceId = await resolveWorkspaceId(base);
    console.log(`${base}/?workspaceId=${encodeURIComponent(workspaceId)}`);
  });

program.parseAsync(process.argv);
