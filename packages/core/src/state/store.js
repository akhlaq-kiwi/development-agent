import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
export class StateStore {
    db;
    constructor(dbPath) {
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
    `);
    }
    upsertWorkItem(item, status, now) {
        this.db
            .prepare(`INSERT INTO work_items (id, provider, title, status, updated_at)
         VALUES (@id, @provider, @title, @status, @updatedAt)
         ON CONFLICT(id, provider) DO UPDATE SET title = @title, status = @status, updated_at = @updatedAt`)
            .run({ id: item.id, provider: item.provider, title: item.title, status, updatedAt: now });
    }
    listWorkItems() {
        return this.db
            .prepare(`SELECT id, provider, title, status, updated_at as updatedAt FROM work_items ORDER BY updated_at DESC`)
            .all();
    }
    appendEvent(event) {
        this.db
            .prepare(`INSERT INTO events (ts, run_id, work_item_id, stage, message, level) VALUES (@ts, @runId, @workItemId, @stage, @message, @level)`)
            .run(event);
    }
    listEvents(limit = 200) {
        return this.db
            .prepare(`SELECT ts, run_id as runId, work_item_id as workItemId, stage, message, level FROM events ORDER BY ts DESC LIMIT ?`)
            .all(limit);
    }
    close() {
        this.db.close();
    }
}
