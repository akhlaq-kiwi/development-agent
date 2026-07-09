import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { RunEvent, WorkItem } from "../types.js";

export type WorkItemStatus = "open" | "in_progress" | "done" | "failed";

export interface WorkItemRecord {
  id: string;
  provider: string;
  title: string;
  status: WorkItemStatus;
  updatedAt: number;
}

export class StateStore {
  private readonly db: Database.Database;

  constructor(dbPath: string) {
    mkdirSync(dirname(dbPath), { recursive: true });
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS work_items (
        id TEXT NOT NULL,
        provider TEXT NOT NULL,
        title TEXT NOT NULL,
        status TEXT NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY (id, provider)
      );
      CREATE TABLE IF NOT EXISTS events (
        ts INTEGER NOT NULL,
        run_id TEXT NOT NULL,
        work_item_id TEXT NOT NULL,
        stage TEXT NOT NULL,
        message TEXT NOT NULL,
        level TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS project_configs (
        project_dir TEXT PRIMARY KEY,
        config_json TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      );
    `);
  }

  upsertWorkItem(item: WorkItem, status: WorkItemStatus, now: number): void {
    this.db
      .prepare(
        `INSERT INTO work_items (id, provider, title, status, updated_at)
         VALUES (@id, @provider, @title, @status, @updatedAt)
         ON CONFLICT(id, provider) DO UPDATE SET title = @title, status = @status, updated_at = @updatedAt`
      )
      .run({ id: item.id, provider: item.provider, title: item.title, status, updatedAt: now });
  }

  listWorkItems(): WorkItemRecord[] {
    return this.db
      .prepare(`SELECT id, provider, title, status, updated_at as updatedAt FROM work_items ORDER BY updated_at DESC`)
      .all() as WorkItemRecord[];
  }

  appendEvent(event: RunEvent): void {
    this.db
      .prepare(
        `INSERT INTO events (ts, run_id, work_item_id, stage, message, level) VALUES (@ts, @runId, @workItemId, @stage, @message, @level)`
      )
      .run(event);
  }

  listEvents(limit = 200): RunEvent[] {
    return this.db
      .prepare(
        `SELECT ts, run_id as runId, work_item_id as workItemId, stage, message, level FROM events ORDER BY ts DESC LIMIT ?`
      )
      .all(limit) as RunEvent[];
  }

  /** Project-local config override, keyed by absolute project directory. Replaces the .builder.yml file. */
  getProjectConfig(projectDir: string): Record<string, unknown> | null {
    const row = this.db
      .prepare(`SELECT config_json as configJson FROM project_configs WHERE project_dir = ?`)
      .get(projectDir) as { configJson: string } | undefined;
    return row ? (JSON.parse(row.configJson) as Record<string, unknown>) : null;
  }

  setProjectConfig(projectDir: string, config: Record<string, unknown>, now: number): void {
    this.db
      .prepare(
        `INSERT INTO project_configs (project_dir, config_json, updated_at)
         VALUES (@projectDir, @configJson, @updatedAt)
         ON CONFLICT(project_dir) DO UPDATE SET config_json = @configJson, updated_at = @updatedAt`
      )
      .run({ projectDir, configJson: JSON.stringify(config), updatedAt: now });
  }

  close(): void {
    this.db.close();
  }
}
