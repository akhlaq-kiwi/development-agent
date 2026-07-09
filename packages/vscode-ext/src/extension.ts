import * as vscode from "vscode";
import { ensureDaemon } from "./daemon-client.js";
import { WorkItemsProvider } from "./workItemsProvider.js";

export function activate(context: vscode.ExtensionContext) {
  const provider = new WorkItemsProvider();
  vscode.window.registerTreeDataProvider("builder.workItems", provider);

  context.subscriptions.push(
    vscode.commands.registerCommand("builder.refresh", () => provider.refresh()),

    vscode.commands.registerCommand("builder.run", async () => {
      const projectDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!projectDir) {
        void vscode.window.showErrorMessage("Builder: open a project folder first");
        return;
      }
      const base = await ensureDaemon();
      const res = await fetch(`${base}/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectDir }),
      });
      if (!res.ok) {
        void vscode.window.showErrorMessage(`Builder: failed to start run — ${await res.text()}`);
        return;
      }
      void vscode.window.showInformationMessage("Builder: run started");
      provider.refresh();
    }),

    vscode.commands.registerCommand("builder.openDashboard", async () => {
      const base = await ensureDaemon();
      void vscode.env.openExternal(vscode.Uri.parse(base));
    }),

    vscode.commands.registerCommand("builder.configure", async () => {
      const projectDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
      if (!projectDir) {
        void vscode.window.showErrorMessage("Builder: open a project folder first");
        return;
      }
      const base = await ensureDaemon();
      const url = `${base}/config?projectDir=${encodeURIComponent(projectDir)}`;
      const panel = vscode.window.createWebviewPanel("builderConfig", "Builder: Configure", vscode.ViewColumn.One, {
        enableScripts: true,
        retainContextWhenHidden: true,
      });
      panel.webview.html = `<!doctype html>
<html><head><meta http-equiv="Content-Security-Policy" content="default-src 'none'; frame-src ${base}; style-src 'unsafe-inline';"></head>
<body style="margin:0;padding:0;"><iframe src="${url}" style="border:0;width:100vw;height:100vh;"></iframe></body></html>`;
    })
  );

  const interval = setInterval(() => provider.refresh(), 10_000);
  context.subscriptions.push({ dispose: () => clearInterval(interval) });
}

export function deactivate() {}
