import { loadConfig, createProvider, createAgent, Orchestrator, StateStore, type RunEvent } from "@builder/core";

export interface RunLoopState {
  running: boolean;
  inFlight: boolean;
  nextCheckAt: number | null;
  timer?: NodeJS.Timeout;
}

/** One continuous poll-run-sleep loop per workspace, started/stopped independently. */
export class Scheduler {
  private readonly states = new Map<string, RunLoopState>();

  constructor(
    private readonly store: StateStore,
    /** Broadcasts to live WS clients only — does NOT persist. Scheduler-level messages are
     *  persisted explicitly via `persistedEmit`; Orchestrator persists its own events already,
     *  so its `onEvent` is wired to this broadcast-only function to avoid double writes. */
    private readonly broadcast: (event: RunEvent) => void
  ) {}

  private persistedEmit(workspaceId: string, event: Omit<RunEvent, "workspaceId">): void {
    const full: RunEvent = { ...event, workspaceId };
    this.store.appendEvent(full);
    this.broadcast(full);
  }

  hasAnyRunning(): boolean {
    for (const state of this.states.values()) {
      if (state.running) return true;
    }
    return false;
  }

  getState(workspaceId: string): { running: boolean; inFlight: boolean; nextCheckAt: number | null } {
    const state = this.states.get(workspaceId);
    return state
      ? { running: state.running, inFlight: state.inFlight, nextCheckAt: state.nextCheckAt }
      : { running: false, inFlight: false, nextCheckAt: null };
  }

  start(workspaceId: string, singleRun: boolean): { started: boolean; reason?: string } {
    const existing = this.states.get(workspaceId);
    if (existing?.running) return { started: false, reason: "already running" };

    const state: RunLoopState = { running: true, inFlight: false, nextCheckAt: null };
    this.states.set(workspaceId, state);
    this.persistedEmit(workspaceId, { ts: Date.now(), runId: "scheduler", workItemId: "-", stage: "fetch", message: "Run loop started", level: "info" });
    void this.cycle(workspaceId, singleRun);
    return { started: true };
  }

  stop(workspaceId: string): { stopped: boolean } {
    const state = this.states.get(workspaceId);
    if (!state) return { stopped: false };
    state.running = false;
    state.nextCheckAt = null;
    if (state.timer) clearTimeout(state.timer);
    this.persistedEmit(workspaceId, { ts: Date.now(), runId: "scheduler", workItemId: "-", stage: "done", message: "Run loop stopped", level: "info" });
    return { stopped: true };
  }

  private async cycle(workspaceId: string, singleRun: boolean): Promise<void> {
    const state = this.states.get(workspaceId);
    if (!state || !state.running) return;

    state.inFlight = true;
    state.nextCheckAt = null;
    try {
      const config = loadConfig(workspaceId, this.store);
      if (!config.provider) {
        throw new Error("No issue provider configured — use the Config page to set one up");
      }
      if (!config.projectDir) {
        throw new Error("No project path set — use the Config page to set one up");
      }
      const token = this.store.getSecret(workspaceId) ?? "";
      const provider = createProvider(config.provider, token);
      const agent = createAgent(config.agent.kind);
      const orchestrator = new Orchestrator({
        workspaceId,
        config,
        provider,
        agent,
        store: this.store,
        projectDir: config.projectDir,
        token,
        singleRun,
        onEvent: this.broadcast,
      });
      await orchestrator.run();
    } catch (err) {
      this.persistedEmit(workspaceId, { ts: Date.now(), runId: "scheduler", workItemId: "-", stage: "error", message: String(err), level: "error" });
    }
    state.inFlight = false;

    if (!state.running) return;

    const config = loadConfig(workspaceId, this.store);
    const intervalMs = config.schedule.pollIntervalSeconds * 1000;
    state.nextCheckAt = Date.now() + intervalMs;
    this.persistedEmit(workspaceId, {
      ts: Date.now(),
      runId: "scheduler",
      workItemId: "-",
      stage: "fetch",
      message: `Sleeping ${config.schedule.pollIntervalSeconds}s until next check`,
      level: "info",
    });
    state.timer = setTimeout(() => void this.cycle(workspaceId, singleRun), intervalMs);
  }
}
