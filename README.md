# Builder

Multi-provider, multi-agent issue-to-PR automation. Fetches open work items (GitHub, Jira, or Azure DevOps),
runs a coding agent (Claude or Antigravity) against each one, self-heals on verification failures,
opens a PR (or merges directly), and optionally deploys — with a CLI, a local dashboard, and a VSCode
extension all watching the same run.

## Monorepo layout

```text
packages/
  core/         # engine: config, provider adapters, agent adapters, orchestrator, SQLite state store
  cli/          # `builder` command line tool
  daemon/       # local HTTP/WS API + dashboard, started on-demand (no persistent service)
  vscode-ext/   # VSCode extension: work item tree view + run/dashboard commands
legacy/         # original bash scripts, kept as a behavior reference during the rewrite
```

The daemon is **not** a background service — the CLI and the VSCode extension each spawn it on first
use (checking a lock file at `~/.local/state/builder/daemon.json`) and it stays up until the machine
restarts or it's killed; there's nothing to install as a launchd/systemd unit.

## Setup

```bash
pnpm install
pnpm build
```

This builds `@builder/core`, `@builder/cli`, `@builder/daemon`, and `builder-vscode` in dependency order.

To use the CLI globally:

```bash
npm link ./packages/cli   # or: pnpm --filter @builder/cli exec npm link
```

## Configuration

Global defaults live at `~/.config/builder/config.yml` (still a YAML file — it's machine-wide, not
project state). The project-local override is **not** a file — it lives in the same SQLite database
the daemon already uses for work items and events (`~/.local/state/builder/state.db`, `project_configs`
table, keyed by absolute project path), and you edit it through a UI rather than hand-writing YAML:

```bash
builder configure   # prints a URL to a config form (starts the daemon if needed)
```

Open that URL, or run `Builder: Configure` from the VSCode command palette — both render the same
form (agent kind/timeout, provider kind + its fields, deploy toggles) and POST to the daemon's
`/config` endpoint, which validates against `BuilderConfigSchema` before persisting.

Jira and Azure DevOps use the same PAT-based pattern — see `ProviderConfigSchema` in
`packages/core/src/config/schema.ts` for their required fields (`baseUrl`/`projectKey`/`email` for
Jira; `organization`/`project` for Azure DevOps). PATs themselves are never stored — only the name of
the environment variable to read them from.

## CLI

```bash
builder configure            # print the config form URL for the current project
builder run [--single]       # start processing open work items in the current project
builder status                # list tracked work items and their state
builder logs                  # show recent orchestration events
builder dashboard              # print the dashboard URL (starts the daemon if needed)
```

## Dashboard

`builder dashboard` prints a `http://127.0.0.1:<port>/?projectDir=...` URL serving a live view of the
work item queue and a WebSocket-streamed event log, with a "Config" link to the same form the CLI and
extension use.

## VSCode extension

`packages/vscode-ext` adds a "Builder" activity bar view with the work item queue, plus commands
`Builder: Run`, `Builder: Refresh Work Items`, `Builder: Open Dashboard`, and `Builder: Configure`
(opens the config form in an embedded webview). Package it with `vsce` or run it via the Extension
Development Host (`F5` from `packages/vscode-ext`) once dependencies are built.

## Extending

- **New issue provider**: implement `IssueProvider` in `packages/core/src/providers/`, add its config
  schema to `ProviderConfigSchema`, and register it in `providers/index.ts`.
- **New agent**: implement `AgentAdapter` in `packages/core/src/agents/`, register it in `agents/index.ts`.
- **Verify/deploy commands**: currently shell out to `legacy/verify.sh` / `legacy/deploy.sh` by default;
  override via `Orchestrator`'s `verifyCommand`/`deployCommand` options once your target project has its
  own scripts.
