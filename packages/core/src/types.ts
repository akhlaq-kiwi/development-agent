export type AgentKind = "claude" | "antigravity";
export type ProviderKind = "github" | "jira" | "azure-devops";

export interface WorkItem {
  /** Provider-native identifier, e.g. GitHub issue number, Jira key, ADO work item id */
  id: string;
  title: string;
  body: string;
  url?: string;
  provider: ProviderKind;
  labels: string[];
}

export interface IssueProvider {
  readonly kind: ProviderKind;
  listOpenWorkItems(): Promise<WorkItem[]>;
  markInProgress(item: WorkItem): Promise<void>;
  removeInProgress(item: WorkItem): Promise<void>;
  markDone(item: WorkItem): Promise<void>;
}

export interface AgentRunRequest {
  workItem: WorkItem;
  workspaceDir: string;
  verifyErrors?: string;
  timeout?: string;
}

export interface AgentRunResult {
  success: boolean;
  exitCode: number;
  log: string;
}

export interface AgentAdapter {
  readonly kind: AgentKind;
  run(req: AgentRunRequest): Promise<AgentRunResult>;
}

export interface RunEvent {
  ts: number;
  runId: string;
  workItemId: string;
  stage: "fetch" | "agent" | "verify" | "git" | "deploy" | "done" | "error";
  message: string;
  level: "info" | "warn" | "error";
}
