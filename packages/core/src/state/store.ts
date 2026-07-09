import Database from "better-sqlite3";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, basename } from "node:path";
import type { RunEvent, WorkItem } from "../types.js";

export type WorkItemStatus = "open" | "in_progress" | "done" | "failed";

export interface WorkItemRecord {
  id: string;
  provider: string;
  title: string;
  status: WorkItemStatus;
  updatedAt: number;
}

export interface WorkspaceRecord {
  id: string;
  name: string;
  projectDir: string | null;
  createdAt: number;
}

export class StateStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS workspaces (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        project_dir TEXT,
        created_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS work_items (
        workspace_id TEXT NOT NULL,
        id TEXT NOT NULL,
        provider TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (workspace_id, id, provider)
      );
      CREATE TABLE IF NOT EXISTS events (
        ts INTEGER NOT NULL,
        workspace_id TEXT NOT NULL,
        run_id TEXT NOT NULL,
        work_item_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        message TEXT NOT NULL,
        level TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_events_workspace ON events (workspace_id, ts DESC);
      CREATE TABLE IF NOT EXISTS project_configs (
        workspace_id TEXT PRIMARY KEY,
        config_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS project_secrets (
        workspace_id TEXT PRIMARY KEY,
        token TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  // ---- Workspaces ----

  /** Creates a new workspace identified only by name; its project directory is set later via config. */
  createWorkspace(name: string, now: number): WorkspaceRecord {
    const id = randomUUID();
    this.db
      .prepare(`INSERT INTO workspaces (id, name, project_dir, created_at) VALUES (?, ?, NULL, ?)`)
      .run(id, name, now);
    return { id, name, projectDir: null, createdAt: now };
  }

  /** Finds the workspace for a given path, or creates one named after its directory (CLI convenience). */
  resolveWorkspaceByPath(projectDir: string, now: number): WorkspaceRecord {
    const existing = this.db
      .prepare(
        `SELECT id, name, project_dir as projectDir, created_at as createdAt FROM workspaces WHERE project_dir = ?`
      )
      .get(projectDir) as WorkspaceRecord | undefined;
    if (existing) return existing;

    const id = randomUUID();
    const name = basename(projectDir) || projectDir;
    this.db
      .prepare(`INSERT INTO workspaces (id, name, project_dir, created_at) VALUES (?, ?, ?, ?)`)
      .run(id, name, projectDir, now);
    return { id, name, projectDir, createdAt: now };
  }

  setWorkspaceProjectDir(workspaceId: string, projectDir: string): void {
    this.db.prepare(`UPDATE workspaces SET project_dir = ? WHERE id = ?`).run(projectDir, workspaceId);
  }

  getWorkspace(workspaceId: string): WorkspaceRecord | null {
    const row = this.db
      .prepare(`SELECT id, name, project_dir as projectDir, created_at as createdAt FROM workspaces WHERE id = ?`)
      .get(workspaceId) as WorkspaceRecord | undefined;
    return row ?? null;
  }

  listWorkspaces(): WorkspaceRecord[] {
    return this.db
      .prepare(`SELECT id, name, project_dir as projectDir, created_at as createdAt FROM workspaces ORDER BY created_at ASC`)
      .all() as WorkspaceRecord[];
  }

  removeWorkspace(workspaceId: string): void {
    const tx = this.db.transaction((id: string) => {
      this.db.prepare(`DELETE FROM workspaces WHERE id = ?`).run(id);
      this.db.prepare(`DELETE FROM project_configs WHERE workspace_id = ?`).run(id);
      this.db.prepare(`DELETE FROM project_secrets WHERE workspace_id = ?`).run(id);
      this.db.prepare(`DELETE FROM work_items WHERE workspace_id = ?`).run(id);
      this.db.prepare(`DELETE FROM events WHERE workspace_id = ?`).run(id);
    });
    tx(workspaceId);
  }

  // ---- Work items ----

  upsertWorkItem(workspaceId: string, item: WorkItem, status: WorkItemStatus, now: number): void {
    this.db
      .prepare(
        `INSERT INTO work_items (workspace_id, id, provider, title, status, updated_at)
         VALUES (@workspaceId, @id, @provider, @title, @status, @updatedAt)
         ON CONFLICT(workspace_id, id, provider) DO UPDATE SET title = @title, status = @status, updated_at = @updatedAt`
      )
      .run({ workspaceId, id: item.id, provider: item.provider, title: item.title, status, updatedAt: now });
  }

  listWorkItems(workspaceId: string): WorkItemRecord[] {
    return this.db
      .prepare(
        `SELECT id, provider, title, status, updated_at as updatedAt FROM work_items WHERE workspace_id = ? ORDER BY updated_at DESC`
      )
      .all(workspaceId) as WorkItemRecord[];
  }

  // ---- Events ----

  appendEvent(event: RunEvent): void {
    this.db
      .prepare(
        `INSERT INTO events (ts, workspace_id, run_id, work_item_id, stage, message, level)
         VALUES (@ts, @workspaceId, @runId, @workItemId, @stage, @message, @level)`
      )
      .run(event);
  }

  /** Newest-first, most recent `limit` events for a workspace. */
  listEvents(workspaceId: string, limit = 200): RunEvent[] {
    return this.db
      .prepare(
        `SELECT ts, workspace_id as workspaceId, run_id as runId, work_item_id as workItemId, stage, message, level
         FROM events WHERE workspace_id = ? ORDER BY ts DESC LIMIT ?`
      )
      .all(workspaceId, limit) as RunEvent[];
  }

  // ---- Config ----

  /** Project config, keyed by workspace id. Replaces the old .builder.yml file. */
  getProjectConfig(workspaceId: string): Record<string, unknown> | null {
    const row = this.db
      .prepare(`SELECT config_json as configJson FROM project_configs WHERE workspace_id = ?`)
      .get(workspaceId) as { configJson: string } | undefined;
    return row ? (JSON.parse(row.configJson) as Record<string, unknown>) : null;
  }

  setProjectConfig(workspaceId: string, config: Record<string, unknown>, now: number): void {
    this.db
      .prepare(
        `INSERT INTO project_configs (workspace_id, config_json, updated_at)
         VALUES (@workspaceId, @configJson, @updatedAt)
         ON CONFLICT(workspace_id) DO UPDATE SET config_json = @configJson, updated_at = @updatedAt`
      )
      .run({ workspaceId, configJson: JSON.stringify(config), updatedAt: now });
  }

  // ---- Secrets ----

  /**
   * The provider access token, entered directly through the config UI and stored locally
   * instead of read from an environment variable. Plaintext in the local SQLite file —
   * equivalent exposure to a .env file on disk, not encrypted at rest.
   */
  hasSecret(workspaceId: string): boolean {
    const row = this.db.prepare(`SELECT 1 FROM project_secrets WHERE workspace_id = ?`).get(workspaceId);
    return Boolean(row);
  }

  getSecret(workspaceId: string): string | null {
    const row = this.db.prepare(`SELECT token FROM project_secrets WHERE workspace_id = ?`).get(workspaceId) as
      | { token: string }
      | undefined;
    return row?.token ?? null;
  }

  setSecret(workspaceId: string, token: string, now: number): void {
    this.db
      .prepare(
        `INSERT INTO project_secrets (workspace_id, token, updated_at)
         VALUES (@workspaceId, @token, @updatedAt)
         ON CONFLICT(workspace_id) DO UPDATE SET token = @token, updated_at = @updatedAt`
      )
      .run({ workspaceId, token, updatedAt: now });
  }

  clearSecret(workspaceId: string): void {
    this.db.prepare(`DELETE FROM project_secrets WHERE workspace_id = ?`).run(workspaceId);
  }

  close(): void {
    this.db.close();
  }
}
