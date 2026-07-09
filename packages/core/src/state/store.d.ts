import type { RunEvent, WorkItem } from "../types.js";
export type WorkItemStatus = "open" | "in_progress" | "done" | "failed";
export interface WorkItemRecord {
    id: string;
    provider: string;
    title: string;
    status: WorkItemStatus;
    updatedAt: number;
}
export declare class StateStore {
    private readonly db;
    constructor(dbPath: string);
    upsertWorkItem(item: WorkItem, status: WorkItemStatus, now: number): void;
    listWorkItems(): WorkItemRecord[];
    appendEvent(event: RunEvent): void;
    listEvents(limit?: number): RunEvent[];
    close(): void;
}
