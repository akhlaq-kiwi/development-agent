import { mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const STATE_DIR = join(homedir(), ".local", "state", "builder");
const DEFAULT_PORT = 47893;
const PORT = Number(process.env.BUILDER_DAEMON_PORT ?? DEFAULT_PORT);
const BASE_URL = `http://127.0.0.1:${PORT}`;

async function pingDaemon(): Promise<boolean> {
  try {
    const res = await fetch(`${BASE_URL}/status`, { signal: AbortSignal.timeout(500) });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Starts the daemon if it isn't already running, then returns its base URL. On-demand only —
 * no persistent service. Uses a fixed port (not a lock file) as the source of truth for whether
 * a daemon is already running, so a stale/deleted lock file can never cause a duplicate instance.
 */
export async function ensureDaemon(): Promise<string> {
  if (await pingDaemon()) return BASE_URL;

  mkdirSync(STATE_DIR, { recursive: true });
  const child = spawn(process.execPath, [require.resolve("@builder/daemon/dist/main.js")], {
    detached: true,
    stdio: "ignore",
  });
  child.unref();

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 150));
    if (await pingDaemon()) return BASE_URL;
  }
  throw new Error("Timed out waiting for builder daemon to start");
}
