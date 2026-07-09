import * as vscode from "vscode";

/** Resolves (or creates) the workspace matching the currently open VSCode folder. */
export async function resolveWorkspaceId(base: string): Promise<string | null> {
  const projectDir = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
  if (!projectDir) return null;
  const res = await fetch(`${base}/workspaces/resolve`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectDir }),
  });
  if (!res.ok) throw new Error(await res.text());
  const ws = (await res.json()) as { id: string };
  return ws.id;
}
