import * as vscode from "vscode";
import { ensureDaemon } from "./daemon-client.js";

interface WorkItemRecord {
  id: string;
  provider: string;
  title: string;
  status: string;
  updatedAt: number;
}

export class WorkItemsProvider implements vscode.TreeDataProvider<WorkItemRecord> {
  private readonly _onDidChangeTreeData = new vscode.EventEmitter<void>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  getTreeItem(element: WorkItemRecord): vscode.TreeItem {
    const item = new vscode.TreeItem(`${element.provider}#${element.id} — ${element.title}`);
    item.description = element.status;
    item.iconPath = new vscode.ThemeIcon(
      element.status === "done" ? "check" : element.status === "failed" ? "error" : element.status === "in_progress" ? "sync" : "circle-outline"
    );
    return item;
  }

  async getChildren(): Promise<WorkItemRecord[]> {
    try {
      const base = await ensureDaemon();
      const res = await fetch(`${base}/work-items`);
      return (await res.json()) as WorkItemRecord[];
    } catch (err) {
      void vscode.window.showErrorMessage(`Builder: failed to load work items — ${String(err)}`);
      return [];
    }
  }
}
