export const CONFIG_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Builder Config</title>
<style>
  body { font-family: -apple-system, sans-serif; margin: 1.5rem; background: #0d1117; color: #e6edf3; max-width: 640px; }
  h1 { font-size: 1.2rem; }
  label { display: block; margin-top: 0.9rem; font-size: 0.85rem; color: #9198a1; }
  input, select { width: 100%; box-sizing: border-box; padding: 0.4rem 0.5rem; margin-top: 0.2rem; background: #161b22; color: #e6edf3; border: 1px solid #30363d; border-radius: 6px; font-size: 0.9rem; }
  input[type="checkbox"] { width: auto; }
  .checkbox-row { display: flex; align-items: center; gap: 0.5rem; margin-top: 0.9rem; }
  .checkbox-row label { margin: 0; }
  .path-row { display: flex; gap: 0.5rem; align-items: flex-end; }
  .path-row > div { flex: 1; }
  .path-row button { white-space: nowrap; width: auto; margin-top: 0.2rem; padding: 0.4rem 0.8rem; background: #21262d; border: 1px solid #30363d; color: #e6edf3; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
  .path-row button:hover { background: #30363d; }
  fieldset { border: 1px solid #30363d; border-radius: 8px; margin-top: 1.2rem; padding: 0.8rem 1rem 1rem; }
  legend { padding: 0 0.4rem; color: #9198a1; font-size: 0.85rem; }
  button[type="submit"] { margin-top: 1.5rem; padding: 0.5rem 1.2rem; background: #238636; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
  button[type="submit"]:hover { background: #2ea043; }
  #status { margin-top: 0.8rem; font-size: 0.85rem; }
  .provider-fields { display: none; }
  .provider-fields.active { display: block; }
  .hint { font-size: 0.75rem; color: #6e7681; margin-top: 0.3rem; }
</style>
</head>
<body>
  <h1>Builder Configuration <a href="/" style="font-size: 0.8rem; float: right;">All Projects</a></h1>
  <div id="status"></div>
  <form id="form">
    <fieldset>
      <legend>Project</legend>
      <label>Path
        <div class="path-row">
          <div><input id="projectDir" name="projectDir" placeholder="/path/to/your/project" /></div>
          <button type="button" id="browseBtn">Browse…</button>
        </div>
      </label>
      <div class="hint">The local (or cloned) directory Builder will work in. If it's empty and a GitHub repository is set below, Builder will clone it automatically on first run.</div>
    </fieldset>

    <fieldset>
      <legend>Agent</legend>
      <label>Kind
        <select name="agent.kind">
          <option value="claude">claude</option>
          <option value="antigravity">antigravity</option>
        </select>
      </label>
    </fieldset>

    <fieldset>
      <legend>Issue Provider</legend>
      <label>Kind
        <select id="providerKind" name="provider.kind">
          <option value="github">github</option>
          <option value="jira">jira</option>
          <option value="azure-devops">azure-devops</option>
        </select>
      </label>

      <div class="provider-fields" data-kind="github">
        <label>Repository (owner/repo) <input name="provider.repository" placeholder="owner/repo" /></label>
        <label>Issue label <input name="provider.issueLabel" placeholder="antigravity" /></label>
        <label>Base branch <input name="provider.baseBranch" placeholder="main" /></label>
      </div>

      <div class="provider-fields" data-kind="jira">
        <label>Base URL <input name="provider.baseUrl" placeholder="https://yourorg.atlassian.net" /></label>
        <label>Project key <input name="provider.projectKey" placeholder="PROJ" /></label>
        <label>Email <input name="provider.email" placeholder="you@yourorg.com" /></label>
      </div>

      <div class="provider-fields" data-kind="azure-devops">
        <label>Organization <input name="provider.organization" placeholder="my-org" /></label>
        <label>Project <input name="provider.project" placeholder="my-project" /></label>
      </div>

      <label id="tokenLabel">Access Token
        <input type="password" id="token" name="token" placeholder="paste your PAT here" autocomplete="off" />
      </label>
      <div class="hint" id="tokenHint">Stored locally in this machine's Builder database — never sent anywhere except the provider's API.</div>
    </fieldset>

    <fieldset>
      <legend>Schedule</legend>
      <label>Poll interval, in seconds, between checks for new work items <input name="schedule.pollIntervalSeconds" placeholder="300" /></label>
    </fieldset>

    <fieldset>
      <legend>Deploy</legend>
      <div class="checkbox-row"><input type="checkbox" name="deploy.enabled" id="deployEnabled" /><label for="deployEnabled">Enabled</label></div>
      <div class="checkbox-row"><input type="checkbox" name="deploy.createPr" id="createPr" /><label for="createPr">Create PR (unchecked = merge directly)</label></div>
    </fieldset>

    <button type="submit">Save</button>
  </form>

<script>
const params = new URLSearchParams(location.search);
const workspaceId = params.get('workspaceId') || '';
const form = document.getElementById('form');
const statusEl = document.getElementById('status');
const providerKindSelect = document.getElementById('providerKind');
const tokenInput = document.getElementById('token');
const projectDirInput = document.getElementById('projectDir');
const tokenLabelText = { github: 'GitHub Personal Access Token', jira: 'Jira API Token', 'azure-devops': 'Azure DevOps PAT' };

function showProviderFields(kind) {
  document.querySelectorAll('.provider-fields').forEach(el => {
    el.classList.toggle('active', el.dataset.kind === kind);
  });
  document.querySelector('#tokenLabel').firstChild.textContent = tokenLabelText[kind] || 'Access Token';
}
providerKindSelect.addEventListener('change', () => showProviderFields(providerKindSelect.value));

function setField(name, value) {
  const el = form.elements.namedItem(name);
  if (!el) return;
  if (el.type === 'checkbox') el.checked = Boolean(value);
  else el.value = value ?? '';
}

document.getElementById('browseBtn').addEventListener('click', async () => {
  const res = await fetch('/pick-folder', { method: 'POST' });
  const data = await res.json();
  if (data.path) projectDirInput.value = data.path;
});

async function load() {
  if (!workspaceId) {
    statusEl.textContent = 'Missing workspaceId query param.';
    return;
  }
  const res = await fetch(\`/config?workspaceId=\${encodeURIComponent(workspaceId)}\`);
  const cfg = await res.json();
  projectDirInput.value = cfg.projectDir ?? '';
  setField('agent.kind', cfg.agent?.kind ?? 'claude');
  const kind = cfg.provider?.kind ?? 'github';
  setField('provider.kind', kind);
  showProviderFields(kind);
  if (cfg.provider) {
    for (const [k, v] of Object.entries(cfg.provider)) setField('provider.' + k, v);
  }
  setField('deploy.enabled', cfg.deploy?.enabled ?? false);
  setField('deploy.createPr', cfg.deploy?.createPr ?? true);
  setField('schedule.pollIntervalSeconds', cfg.schedule?.pollIntervalSeconds ?? 300);
  if (cfg.hasSecret) {
    tokenInput.placeholder = '•••••••••••••• (saved — leave blank to keep)';
  }
}
load();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  if (!projectDirInput.value.trim()) {
    statusEl.textContent = 'Project path is required.';
    statusEl.style.color = '#f85149';
    return;
  }
  const data = new FormData(form);
  const config = { agent: {}, provider: { kind: providerKindSelect.value }, deploy: {}, schedule: {}, projectDir: projectDirInput.value.trim() };
  for (const [key, value] of data.entries()) {
    if (key === 'token' || key === 'projectDir') continue;
    const [section, field] = key.split('.');
    if (section === 'agent') config.agent[field] = value;
    if (section === 'provider' && field !== 'kind') config.provider[field] = value;
    if (section === 'deploy') config.deploy[field] = true;
    if (section === 'schedule') config.schedule[field] = Number(value) || undefined;
  }
  config.deploy.enabled = form.elements.namedItem('deploy.enabled').checked;
  config.deploy.createPr = form.elements.namedItem('deploy.createPr').checked;

  const res = await fetch('/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, config }),
  });
  if (!res.ok) {
    const err = await res.json();
    statusEl.textContent = 'Error: ' + err.error;
    statusEl.style.color = '#f85149';
    return;
  }

  if (tokenInput.value) {
    const secretRes = await fetch('/secret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ workspaceId, token: tokenInput.value }),
    });
    if (!secretRes.ok) {
      const err = await secretRes.json();
      statusEl.textContent = 'Saved config, but token failed to save: ' + err.error;
      statusEl.style.color = '#f85149';
      return;
    }
  }

  statusEl.textContent = 'Saved. Opening dashboard…';
  statusEl.style.color = '#3fb950';
  setTimeout(() => {
    location.href = '/?workspaceId=' + encodeURIComponent(workspaceId);
  }, 600);
});
</script>
</body>
</html>
`;
