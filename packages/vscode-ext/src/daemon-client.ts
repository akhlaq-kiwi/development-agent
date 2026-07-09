import { existsSync, readFileSync, mkdirSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { spawn } from "node:child_process";

const STATE_DIR = join(homedir(), ".local", "state", "builder");
const LOCK_FILE = join(STATE_DIR, "daemon.json");

interface DaemonLock {
  pid: number;
  port: number;
}

function readLock(): DaemonLock | null {
  if (!existsSync(LOCK_FILE)) return null;
  try {
    return JSON.parse(readFileSync(LOCK_FILE, "utf8")) as DaemonLock;
  } catch {
    return null;
  }
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function pingDaemon(port: number): Promise<boolean> {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/status`, { signal: AbortSignal.timeout(500) });
    return res.ok;
  } catch {
    return false;
  }
}

/** Same on-demand semantics as the CLI: never keeps a persistent service running by itself. */
export async function ensureDaemon(): Promise<string> {
  const lock = readLock();
  if (lock && isAlive(lock.pid) && (await pingDaemon(lock.port))) {
    return `http://127.0.0.1:${lock.port}`;
  }

  mkdirSync(STATE_DIR, { recursive: true });
  const daemonEntry = require.resolve("@builder/daemon/dist/main.js");
  const child = spawn(process.execPath, [daemonEntry], { detached: true, stdio: "ignore" });
  child.unref();

  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 150));
    const newLock = readLock();
    if (newLock && (await pingDaemon(newLock.port))) {
      return `http://127.0.0.1:${newLock.port}`;
    }
  }
  throw new Error("Timed out waiting for builder daemon to start");
}
