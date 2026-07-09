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
  fieldset { border: 1px solid #30363d; border-radius: 8px; margin-top: 1.2rem; padding: 0.8rem 1rem 1rem; }
  legend { padding: 0 0.4rem; color: #9198a1; font-size: 0.85rem; }
  button { margin-top: 1.5rem; padding: 0.5rem 1.2rem; background: #238636; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.9rem; }
  button:hover { background: #2ea043; }
  #status { margin-top: 0.8rem; font-size: 0.85rem; }
  .provider-fields { display: none; }
  .provider-fields.active { display: block; }
</style>
</head>
<body>
  <h1>Builder Configuration</h1>
  <div id="status"></div>
  <form id="form">
    <fieldset>
      <legend>Agent</legend>
      <label>Kind
        <select name="agent.kind">
          <option value="claude">claude</option>
          <option value="antigravity">antigravity</option>
        </select>
      </label>
      <label>Timeout <input name="agent.timeout" placeholder="20m" /></label>
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
        <label>PAT env var <input name="provider.patEnvVar" placeholder="GITHUB_PAT" /></label>
      </div>

      <div class="provider-fields" data-kind="jira">
        <label>Base URL <input name="provider.baseUrl" placeholder="https://yourorg.atlassian.net" /></label>
        <label>Project key <input name="provider.projectKey" placeholder="PROJ" /></label>
        <label>Email <input name="provider.email" placeholder="you@yourorg.com" /></label>
        <label>API token env var <input name="provider.patEnvVar" placeholder="JIRA_PAT" /></label>
      </div>

      <div class="provider-fields" data-kind="azure-devops">
        <label>Organization <input name="provider.organization" placeholder="my-org" /></label>
        <label>Project <input name="provider.project" placeholder="my-project" /></label>
        <label>PAT env var <input name="provider.patEnvVar" placeholder="AZURE_DEVOPS_PAT" /></label>
      </div>
    </fieldset>

    <fieldset>
      <legend>Deploy</legend>
      <div class="checkbox-row"><input type="checkbox" name="deploy.enabled" id="deployEnabled" /><label for="deployEnabled">Enabled</label></div>
      <div class="checkbox-row"><input type="checkbox" name="deploy.createPr" id="createPr" /><label for="createPr">Create PR (unchecked = merge directly)</label></div>
    </fieldset>

    <button type="submit">Save .builder.yml</button>
  </form>

<script>
const params = new URLSearchParams(location.search);
const projectDir = params.get('projectDir') || '';
const form = document.getElementById('form');
const statusEl = document.getElementById('status');
const providerKindSelect = document.getElementById('providerKind');

function showProviderFields(kind) {
  document.querySelectorAll('.provider-fields').forEach(el => {
    el.classList.toggle('active', el.dataset.kind === kind);
  });
}
providerKindSelect.addEventListener('change', () => showProviderFields(providerKindSelect.value));

function setField(name, value) {
  const el = form.elements.namedItem(name);
  if (!el) return;
  if (el.type === 'checkbox') el.checked = Boolean(value);
  else el.value = value ?? '';
}

async function load() {
  if (!projectDir) {
    statusEl.textContent = 'Missing projectDir query param.';
    return;
  }
  const res = await fetch(\`/config?projectDir=\${encodeURIComponent(projectDir)}\`);
  const cfg = await res.json();
  setField('agent.kind', cfg.agent?.kind ?? 'claude');
  setField('agent.timeout', cfg.agent?.timeout ?? '20m');
  const kind = cfg.provider?.kind ?? 'github';
  setField('provider.kind', kind);
  showProviderFields(kind);
  if (cfg.provider) {
    for (const [k, v] of Object.entries(cfg.provider)) setField('provider.' + k, v);
  }
  setField('deploy.enabled', cfg.deploy?.enabled ?? false);
  setField('deploy.createPr', cfg.deploy?.createPr ?? true);
}
load();

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = new FormData(form);
  const config = { agent: {}, provider: { kind: providerKindSelect.value }, deploy: {} };
  for (const [key, value] of data.entries()) {
    const [section, field] = key.split('.');
    if (section === 'agent') config.agent[field] = value;
    if (section === 'provider' && field !== 'kind') config.provider[field] = value;
    if (section === 'deploy') config.deploy[field] = true;
  }
  config.deploy.enabled = form.elements.namedItem('deploy.enabled').checked;
  config.deploy.createPr = form.elements.namedItem('deploy.createPr').checked;

  const res = await fetch('/config', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ projectDir, config }),
  });
  if (res.ok) {
    statusEl.textContent = 'Saved .builder.yml';
    statusEl.style.color = '#3fb950';
  } else {
    const err = await res.json();
    statusEl.textContent = 'Error: ' + err.error;
    statusEl.style.color = '#f85149';
  }
});
</script>
</body>
</html>
`;
