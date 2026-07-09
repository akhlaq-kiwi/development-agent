#!/usr/bin/env node
import { Command } from "commander";
import { ensureDaemon } from "./daemon-client.js";

const program = new Command();
program.name("builder").description("Multi-provider, multi-agent issue-to-PR automation").version("0.1.0");

program
  .command("configure")
  .description("Print the URL of the config form for the current project (starts the daemon if needed)")
  .action(async () => {
    const base = await ensureDaemon();
    console.log(`${base}/config?projectDir=${encodeURIComponent(process.cwd())}`);
  });

program
  .command("run")
  .description("Start processing open work items in the current project")
  .option("-s, --single", "process a single work item then exit")
  .action(async (opts: { single?: boolean }) => {
    const base = await ensureDaemon();
    const res = await fetch(`${base}/run`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projectDir: process.cwd(), singleRun: Boolean(opts.single) }),
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
    const res = await fetch(`${base}/work-items`);
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
  .action(async () => {
    const base = await ensureDaemon();
    const res = await fetch(`${base}/events`);
    const events = (await res.json()) as { ts: number; stage: string; message: string; level: string }[];
    for (const e of events.reverse()) {
      console.log(`${new Date(e.ts).toISOString()} [${e.stage}] ${e.message}`);
    }
  });

program
  .command("dashboard")
  .description("Print the URL of the local dashboard (starts the daemon if needed)")
  .action(async () => {
    const base = await ensureDaemon();
    console.log(`${base}/?projectDir=${encodeURIComponent(process.cwd())}`);
  });

program.parseAsync(process.argv);
