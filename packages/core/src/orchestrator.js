import { spawn } from "node:child_process";
import simpleGit from "simple-git";
function runShell(command, cwd) {
    return new Promise((resolve) => {
        const chunks = [];
        const child = spawn(command, { shell: true, cwd });
        child.stdout.on("data", (d) => chunks.push(d.toString()));
        child.stderr.on("data", (d) => chunks.push(d.toString()));
        child.on("close", (code) => resolve({ code: code ?? 1, log: chunks.join("") }));
        child.on("error", (err) => resolve({ code: 1, log: String(err) }));
    });
}
/** Ports the main_agent.sh loop: fetch -> branch -> agent -> verify (self-heal) -> commit/PR -> deploy. */
export class Orchestrator {
    opts;
    git;
    runId;
    constructor(opts) {
        this.opts = opts;
        this.git = simpleGit(opts.projectDir);
        this.runId = `run-${Date.now()}`;
    }
    emit(workItemId, stage, message, level = "info") {
        const event = { ts: Date.now(), runId: this.runId, workItemId, stage, message, level };
        this.opts.store.appendEvent(event);
        this.opts.onEvent?.(event);
    }
    async processOne(item) {
        const { config, provider, agent, store, projectDir } = this.opts;
        const baseBranch = config.provider?.kind === "github" ? config.provider.baseBranch : "main";
        const branchName = `issue-${item.id}`;
        store.upsertWorkItem(item, "in_progress", Date.now());
        this.emit(item.id, "git", `Checking out base branch ${baseBranch}`);
        await this.git.checkout(baseBranch);
        await this.git.pull("origin", baseBranch).catch(() => undefined);
        const branches = await this.git.branchLocal();
        if (branches.all.includes(branchName)) {
            await this.git.checkout(branchName);
        }
        else {
            await this.git.checkoutLocalBranch(branchName);
        }
        await provider.markInProgress(item);
        const maxRetries = this.opts.maxVerifyRetries ?? 3;
        let verifyErrors = "";
        let passed = false;
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            this.emit(item.id, "agent", `Invoking ${agent.kind} agent (attempt ${attempt}/${maxRetries})`);
            const result = await agent.run({ workItem: item, workspaceDir: projectDir, verifyErrors, timeout: config.agent.timeout });
            if (!result.success) {
                this.emit(item.id, "agent", `Agent exited with code ${result.exitCode}`, "error");
                break;
            }
            this.emit(item.id, "verify", `Running verification (attempt ${attempt}/${maxRetries})`);
            const verifyCmd = this.opts.verifyCommand ?? "../legacy/verify.sh";
            const verifyResult = await runShell(verifyCmd, projectDir);
            if (verifyResult.code === 0) {
                this.emit(item.id, "verify", "Verification passed");
                passed = true;
                break;
            }
            this.emit(item.id, "verify", "Verification failed; feeding errors back to agent", "warn");
            verifyErrors = verifyResult.log.split("\n").slice(-100).join("\n");
        }
        if (!passed) {
            this.emit(item.id, "error", `Verification failed after ${maxRetries} attempts`, "error");
            await provider.removeInProgress(item);
            await this.git.checkout(baseBranch);
            store.upsertWorkItem(item, "failed", Date.now());
            return false;
        }
        const status = await this.git.status();
        const hasChanges = status.files.length > 0;
        if (!hasChanges) {
            this.emit(item.id, "git", "No modifications detected; skipping commit/PR", "warn");
            await provider.removeInProgress(item);
            await this.git.checkout(baseBranch);
            store.upsertWorkItem(item, "failed", Date.now());
            return false;
        }
        await this.git.add(".");
        await this.git.commit(`Fix ${item.id}: ${item.title}`);
        if (config.deploy.createPr) {
            this.emit(item.id, "git", `Pushing branch ${branchName}`);
            await this.git.push(["-u", "origin", branchName, "--force"]);
            this.emit(item.id, "git", "Creating pull request");
            // PR creation is provider-specific; GitHubProvider exposes createPullRequest directly.
            const maybeGitHub = provider;
            if (maybeGitHub.createPullRequest) {
                await maybeGitHub.createPullRequest(branchName, baseBranch, `Fix ${item.id}: ${item.title}`, `Linked work item: ${item.id}`);
            }
        }
        else {
            this.emit(item.id, "git", `Merging ${branchName} into ${baseBranch} directly`);
            await this.git.checkout(baseBranch);
            await this.git.pull("origin", baseBranch).catch(() => undefined);
            await this.git.merge([branchName, "--no-edit"]);
            await this.git.push("origin", baseBranch);
        }
        await provider.markDone(item);
        store.upsertWorkItem(item, "done", Date.now());
        if (config.deploy.enabled && this.opts.deployCommand) {
            this.emit(item.id, "deploy", "Running deploy command");
            const deployResult = await runShell(this.opts.deployCommand, projectDir);
            if (deployResult.code !== 0) {
                this.emit(item.id, "deploy", "Deploy command failed", "error");
            }
        }
        await this.git.checkout(baseBranch);
        this.emit(item.id, "done", "Work item processed successfully");
        return true;
    }
    async run() {
        const items = await this.opts.provider.listOpenWorkItems();
        for (const item of items) {
            const done = await this.processOne(item);
            if (this.opts.singleRun && done)
                break;
        }
    }
}
