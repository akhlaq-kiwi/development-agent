import { createServer } from "node:http";
import { WebSocketServer, type WebSocket } from "ws";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import {
  loadConfig,
  createProvider,
  createAgent,
  StateStore,
  Orchestrator,
  readProjectConfig,
  writeProjectConfig,
  type RunEvent,
} from "@builder/core";
import { DASHBOARD_HTML } from "./dashboard.js";
import { CONFIG_HTML } from "./config-page.js";

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

const server = createServer((req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");

  if (url.pathname === "/" && req.method === "GET") {
    res.setHeader("Content-Type", "text/html");
    res.end(DASHBOARD_HTML);
    return;
  }

  if (url.pathname === "/config" && req.method === "GET" && req.headers.accept?.includes("text/html")) {
    res.setHeader("Content-Type", "text/html");
    res.end(CONFIG_HTML);
    return;
  }

  res.setHeader("Content-Type", "application/json");

  if (url.pathname === "/config" && req.method === "GET") {
    const projectDir = url.searchParams.get("projectDir");
    if (!projectDir) {
      res.statusCode = 400;
      res.end(JSON.stringify({ error: "projectDir query param is required" }));
      return;
    }
    res.end(JSON.stringify(readProjectConfig(store, projectDir)));
    return;
  }

  if (url.pathname === "/config" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        const { projectDir, config } = JSON.parse(body || "{}") as { projectDir: string; config: unknown };
        if (!projectDir) throw new Error("projectDir is required");
        const written = writeProjectConfig(store, projectDir, config);
        res.end(JSON.stringify(written));
      } catch (err) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  if (req.url === "/status" && req.method === "GET") {
    res.end(JSON.stringify({ running: true, pid: process.pid }));
    return;
  }

  if (req.url === "/work-items" && req.method === "GET") {
    res.end(JSON.stringify(store.listWorkItems()));
    return;
  }

  if (req.url?.startsWith("/events") && req.method === "GET") {
    res.end(JSON.stringify(store.listEvents()));
    return;
  }

  if (req.url === "/run" && req.method === "POST") {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", async () => {
      try {
        const { projectDir, singleRun } = JSON.parse(body || "{}") as {
          projectDir: string;
          singleRun?: boolean;
        };
        const config = loadConfig(projectDir, store);
        if (!config.provider) throw new Error("No issue provider configured — use `builder configure` or the dashboard's Config page");
        const provider = createProvider(config.provider);
        const agent = createAgent(config.agent.kind);
        const orchestrator = new Orchestrator({
          config,
          provider,
          agent,
          store,
          projectDir,
          singleRun,
          onEvent: broadcast,
        });
        // Fire and forget; progress streams over WS/events endpoint.
        orchestrator.run().catch((err) => {
          broadcast({ ts: Date.now(), runId: "run", workItemId: "-", stage: "error", message: String(err), level: "error" });
        });
        res.statusCode = 202;
        res.end(JSON.stringify({ started: true }));
      } catch (err) {
        res.statusCode = 400;
        res.end(JSON.stringify({ error: String(err) }));
      }
    });
    return;
  }

  res.statusCode = 404;
  res.end(JSON.stringify({ error: "not found" }));
});

const wss = new WebSocketServer({ server, path: "/stream" });
wss.on("connection", (ws) => {
  sockets.add(ws);
  ws.on("close", () => sockets.delete(ws));
});

const port = Number(process.env.BUILDER_DAEMON_PORT ?? 0);
server.listen(port, () => {
  const actualPort = (server.address() as { port: number }).port;
  writeLock(actualPort);
  console.log(`builder daemon listening on port ${actualPort}`);
});

export { LOCK_FILE };
