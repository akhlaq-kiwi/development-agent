import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";
import { execFile } from "node:child_process";
import { StateStore, readProjectConfig, writeProjectConfig, type RunEvent } from "@builder/core";
import { DASHBOARD_HTML } from "./dashboard.js";
import { CONFIG_HTML } from "./config-page.js";
import { PROJECTS_HTML } from "./projects-page.js";
import { Scheduler } from "./scheduler.js";

const STATE_DIR = join(homedir(), ".local", "state", "builder");
const LOCK_FILE = join(STATE_DIR, "daemon.json");
const DB_FILE = join(STATE_DIR, "state.db");

function writeLock(port: number) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(LOCK_FILE, JSON.stringify({ pid: process.pid, port, startedAt: Date.now() }));
}

const store = new StateStore(DB_FILE);
const sockets = new Set<WebSocket>();

function broadcast(event: RunEvent) {
  const payload = JSON.stringify({ type: "event", event });
  for (const ws of sockets) ws.send(payload);
}

const scheduler = new Scheduler(store, broadcast);

/** macOS-only native folder picker, run from the daemon process (never from the browser). */
function pickFolder(): Promise<string | null> {
  return new Promise((resolvePromise) => {
    execFile(
      "osascript",
      ["-e", 'POSIX path of (choose folder with prompt "Select a project folder:")'],
      (err, stdout) => {
        if (err) {
          resolvePromise(null);
          return;
        }
        const path = stdout.trim().replace(/\/$/, "");
        resolvePromise(path || null);
      }
    );
  });
}

function readBody(req: import("node:http").IncomingMessage): Promise<string> {
  return new Promise((resolvePromise) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => resolvePromise(body));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/" && req.method === "GET") {
    res.setHeader("Content-Type", "text/html");
    res.end(url.searchParams.get("workspaceId") ? DASHBOARD_HTML : PROJECTS_HTML);
    return;
  }

  if (url.pathname === "/config" && req.method === "GET" && req.headers.accept?.includes("text/html")) {
    res.setHeader("Content-Type", "text/html");
    res.end(CONFIG_HTML);
    return;
  }

  res.setHeader("Content-Type", "application/json");

  try {
    if (url.pathname === "/workspaces" && req.method === "GET") {
      const projects = store.listWorkspaces().map((ws) => {
        const config = readProjectConfig(store, ws.id);
        const state = scheduler.getState(ws.id);
        return {
          id: ws.id,
          name: ws.name,
          projectDir: ws.projectDir,
          configured: Boolean(config.provider && ws.projectDir),
          ...state,
        };
      });
      res.end(JSON.stringify(projects));
      return;
    }

    if (url.pathname === "/workspaces" && req.method === "POST") {
      const { name } = JSON.parse((await readBody(req)) || "{}") as { name?: string };
      if (!name || !name.trim()) throw new Error("name is required");
      const ws = store.createWorkspace(name.trim(), Date.now());
      res.statusCode = 201;
      res.end(JSON.stringify(ws));
      return;
    }

    // CLI convenience: resolve-or-create a workspace by filesystem path.
    if (url.pathname === "/workspaces/resolve" && req.method === "POST") {
      const { projectDir } = JSON.parse((await readBody(req)) || "{}") as { projectDir: string };
      if (!projectDir) throw new Error("projectDir is required");
      const ws = store.resolveWorkspaceByPath(resolve(projectDir), Date.now());
      res.end(JSON.stringify(ws));
      return;
    }

    const workspaceIdMatch = url.pathname.match(/^\/workspaces\/([^/]+)$/);
    if (workspaceIdMatch && req.method === "GET") {
      const ws = store.getWorkspace(workspaceIdMatch[1]);
      if (!ws) {
        res.statusCode = 404;
        res.end(JSON.stringify({ error: "workspace not found" }));
        return;
      }
      res.end(JSON.stringify(ws));
      return;
    }

    if (workspaceIdMatch && req.method === "DELETE") {
      scheduler.stop(workspaceIdMatch[1]);
      store.removeWorkspace(workspaceIdMatch[1]);
      res.end(JSON.stringify({ removed: true }));
      return;
    }

    if (url.pathname === "/config" && req.method === "GET") {
      const workspaceId = url.searchParams.get("workspaceId");
      if (!workspaceId) throw new Error("workspaceId query param is required");
      res.end(JSON.stringify({ ...readProjectConfig(store, workspaceId), hasSecret: store.hasSecret(workspaceId) }));
      return;
    }

    if (url.pathname === "/config" && req.method === "POST") {
      const { workspaceId, config } = JSON.parse((await readBody(req)) || "{}") as {
        workspaceId: string;
        config: unknown;
      };
      if (!workspaceId) throw new Error("workspaceId is required");
      const written = writeProjectConfig(store, workspaceId, config);
      res.end(JSON.stringify(written));
      return;
    }

    if (url.pathname === "/secret" && req.method === "POST") {
      const { workspaceId, token } = JSON.parse((await readBody(req)) || "{}") as {
        workspaceId: string;
        token: string;
      };
      if (!workspaceId) throw new Error("workspaceId is required");
      if (token) store.setSecret(workspaceId, token, Date.now());
      else store.clearSecret(workspaceId);
      res.end(JSON.stringify({ hasSecret: store.hasSecret(workspaceId) }));
      return;
    }

    if (url.pathname === "/status" && req.method === "GET") {
      res.end(JSON.stringify({ running: true, pid: process.pid }));
      return;
    }

    if (url.pathname === "/work-items" && req.method === "GET") {
      const workspaceId = url.searchParams.get("workspaceId");
      if (!workspaceId) throw new Error("workspaceId query param is required");
      res.end(JSON.stringify(store.listWorkItems(workspaceId)));
      return;
    }

    if (url.pathname === "/events" && req.method === "GET") {
      const workspaceId = url.searchParams.get("workspaceId");
      if (!workspaceId) throw new Error("workspaceId query param is required");
      const limitParam = url.searchParams.get("limit");
      const limit = limitParam ? Math.min(Number(limitParam) || 200, 5000) : 200;
      res.end(JSON.stringify(store.listEvents(workspaceId, limit)));
      return;
    }

    if (url.pathname === "/run" && req.method === "POST") {
      const { workspaceId, singleRun } = JSON.parse((await readBody(req)) || "{}") as {
        workspaceId: string;
        singleRun?: boolean;
      };
      if (!workspaceId) throw new Error("workspaceId is required");
      const result = scheduler.start(workspaceId, Boolean(singleRun));
      res.statusCode = result.started ? 202 : 409;
      res.end(JSON.stringify(result));
      return;
    }

    if (url.pathname === "/stop" && req.method === "POST") {
      const { workspaceId } = JSON.parse((await readBody(req)) || "{}") as { workspaceId: string };
      if (!workspaceId) throw new Error("workspaceId is required");
      const result = scheduler.stop(workspaceId);
      res.end(JSON.stringify(result));
      // Nothing else is running — shut the daemon down rather than leaving it idling in the
      // background. It starts back up on-demand the next time the CLI/extension/app needs it.
      if (!scheduler.hasAnyRunning()) {
        setTimeout(() => process.exit(0), 100);
      }
      return;
    }

    if (url.pathname === "/run-state" && req.method === "GET") {
      const workspaceId = url.searchParams.get("workspaceId");
      if (!workspaceId) throw new Error("workspaceId query param is required");
      res.end(JSON.stringify(scheduler.getState(workspaceId)));
      return;
    }

    if (url.pathname === "/pick-folder" && req.method === "POST") {
      const path = await pickFolder();
      res.end(JSON.stringify({ path }));
      return;
    }

    res.statusCode = 404;
    res.end(JSON.stringify({ error: "not found" }));
  } catch (err) {
    res.statusCode = 400;
    res.end(JSON.stringify({ error: String(err) }));
  }
});

const wss = new WebSocketServer({ server, path: "/stream" });
wss.on("connection", (ws) => {
  sockets.add(ws);
  ws.on("close", () => sockets.delete(ws));
});

// Fixed, well-known port rather than an OS-assigned random one: this makes "is the daemon
// already running" a simple TCP-bind check instead of a lock-file race. If the lock file gets
// deleted (or is stale) while a previous daemon process is still alive, a second process
// attempting to start would otherwise never discover the first — and both would run their own
// scheduler loops against the same workspaces, double-invoking agents. Binding the same port
// twice fails fast instead.
const DEFAULT_PORT = 47893;
const port = Number(process.env.BUILDER_DAEMON_PORT ?? DEFAULT_PORT);

server.on("error", (err: NodeJS.ErrnoException) => {
  if (err.code === "EADDRINUSE") {
    console.log(`builder daemon already running on port ${port}; exiting`);
    process.exit(0);
  }
  throw err;
});

server.listen(port, () => {
  const actualPort = (server.address() as { port: number }).port;
  writeLock(actualPort);
  console.log(`builder daemon listening on port ${actualPort}`);
});

export { LOCK_FILE, DEFAULT_PORT };
