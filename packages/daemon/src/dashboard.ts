export const DASHBOARD_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Builder Dashboard</title>
<style>
  body { font-family: -apple-system, sans-serif; margin: 2rem; background: #0d1117; color: #e6edf3; }
  h1 { font-size: 1.2rem; }
  table { width: 100%; border-collapse: collapse; margin-bottom: 2rem; }
  th, td { text-align: left; padding: 0.4rem 0.6rem; border-bottom: 1px solid #30363d; font-size: 0.85rem; }
  .status-open { color: #d29922; }
  .status-in_progress { color: #58a6ff; }
  .status-done { color: #3fb950; }
  .status-failed { color: #f85149; }
  #log { font-family: monospace; font-size: 0.8rem; white-space: pre-wrap; max-height: 50vh; overflow-y: auto; background: #161b22; padding: 1rem; border-radius: 6px; }
  #log div { padding: 0.1rem 0; border-bottom: 1px solid #21262d; }
  #log .level-error { color: #f85149; }
  #log .level-warn { color: #d29922; }
  .toolbar { display: flex; align-items: center; gap: 0.8rem; margin-bottom: 1.2rem; }
  .toolbar label { font-size: 0.85rem; color: #9198a1; display: flex; align-items: center; gap: 0.3rem; }
  button, select.toolbar-select { padding: 0.4rem 1rem; background: #238636; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; }
  button:hover:not(:disabled) { background: #2ea043; }
  button:disabled { background: #30363d; cursor: not-allowed; }
  #stopBtn { background: #da3633; }
  #stopBtn:hover:not(:disabled) { background: #f85149; }
  #runStatus { font-size: 0.8rem; color: #9198a1; }
  #countdown { font-size: 0.8rem; color: #58a6ff; font-family: monospace; }
  select.toolbar-select { background: #21262d; border: 1px solid #30363d; color: #e6edf3; cursor: default; }
  .log-header { display: flex; justify-content: space-between; align-items: center; }
  .log-header select { width: auto; }
</style>
</head>
<body>
  <h1>
    Builder — Work Items
    <a id="configLink" href="#" style="font-size: 0.8rem; float: right; margin-left: 1rem;">Config</a>
    <a href="/" style="font-size: 0.8rem; float: right;">All Projects</a>
  </h1>

  <div class="toolbar">
    <button id="runBtn">Run</button>
    <button id="stopBtn" disabled>Stop</button>
    <label><input type="checkbox" id="singleRun" /> single item per check</label>
    <span id="runStatus"></span>
    <span id="countdown"></span>
  </div>

  <table id="items"><thead><tr><th>Status</th><th>Provider</th><th>ID</th><th>Title</th><th>Updated</th></tr></thead><tbody></tbody></table>

  <div class="log-header">
    <h1>Live Log</h1>
    <label>Show last
      <select id="tailSelect" class="toolbar-select">
        <option value="20">20</option>
        <option value="50" selected>50</option>
        <option value="100">100</option>
        <option value="500">500</option>
        <option value="5000">All</option>
      </select>
      lines
    </label>
  </div>
  <div id="log"></div>
<script>
const params = new URLSearchParams(location.search);
const workspaceId = params.get('workspaceId') || '';
document.getElementById('configLink').href = '/config?workspaceId=' + encodeURIComponent(workspaceId);

const runBtn = document.getElementById('runBtn');
const stopBtn = document.getElementById('stopBtn');
const runStatus = document.getElementById('runStatus');
const countdownEl = document.getElementById('countdown');
const singleRunCheckbox = document.getElementById('singleRun');
const logEl = document.getElementById('log');
const tailSelect = document.getElementById('tailSelect');

let nextCheckAt = null;

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function tickCountdown() {
  if (nextCheckAt == null) {
    countdownEl.textContent = '';
    return;
  }
  const remaining = nextCheckAt - Date.now();
  countdownEl.textContent = remaining > 0 ? 'Next check in ' + formatCountdown(remaining) : 'Checking now…';
}
setInterval(tickCountdown, 1000);

function renderLogEntry(e) {
  const div = document.createElement('div');
  div.className = 'level-' + e.level;
  div.textContent = new Date(e.ts).toLocaleTimeString() + ' [' + e.stage + '] ' + e.message;
  return div;
}

// Events arrive newest-first from the server; render with newest on top.
function renderLog(events) {
  logEl.innerHTML = '';
  for (const e of events) logEl.appendChild(renderLogEntry(e));
}

async function loadLog() {
  if (!workspaceId) return;
  const limit = tailSelect.value;
  const res = await fetch('/events?workspaceId=' + encodeURIComponent(workspaceId) + '&limit=' + limit);
  renderLog(await res.json());
}
loadLog();
tailSelect.addEventListener('change', loadLog);

async function refreshRunState() {
  if (!workspaceId) return;
  const res = await fetch('/run-state?workspaceId=' + encodeURIComponent(workspaceId));
  const state = await res.json();
  nextCheckAt = state.nextCheckAt;
  tickCountdown();
  runBtn.disabled = state.running;
  stopBtn.disabled = !state.running;
  if (state.running) {
    runStatus.textContent = state.inFlight ? 'Checking for work items…' : 'Running.';
  }
}
refreshRunState();
setInterval(refreshRunState, 3000);

runBtn.addEventListener('click', async () => {
  if (!workspaceId) {
    runStatus.textContent = 'Missing workspaceId — open this project from the Projects list.';
    return;
  }
  runBtn.disabled = true;
  runStatus.textContent = 'Starting…';
  const res = await fetch('/run', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId, singleRun: singleRunCheckbox.checked }),
  });
  if (res.ok) {
    runStatus.textContent = 'Run loop started — watch the log below.';
    stopBtn.disabled = false;
  } else {
    const err = await res.json();
    runStatus.textContent = 'Error: ' + (err.error || err.reason);
    runBtn.disabled = false;
  }
});

stopBtn.addEventListener('click', async () => {
  stopBtn.disabled = true;
  await fetch('/stop', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ workspaceId }),
  });
  runStatus.textContent = 'Stopped.';
  runBtn.disabled = false;
  nextCheckAt = null;
  tickCountdown();
});

async function loadItems() {
  if (!workspaceId) return;
  const res = await fetch('/work-items?workspaceId=' + encodeURIComponent(workspaceId));
  const items = await res.json();
  const tbody = document.querySelector('#items tbody');
  tbody.innerHTML = items.map(i => \`<tr>
    <td class="status-\${i.status}">\${i.status}</td>
    <td>\${i.provider}</td>
    <td>\${i.id}</td>
    <td>\${i.title}</td>
    <td>\${new Date(i.updatedAt).toLocaleString()}</td>
  </tr>\`).join('');
}
loadItems();
setInterval(loadItems, 5000);

const ws = new WebSocket(\`ws://\${location.host}/stream\`);
ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  if (data.type === 'event' && data.event.workspaceId === workspaceId) {
    logEl.insertBefore(renderLogEntry(data.event), logEl.firstChild);
    const max = Number(tailSelect.value);
    while (logEl.children.length > max) logEl.removeChild(logEl.lastChild);
    loadItems();
    refreshRunState();
  }
};
</script>
</body>
</html>
`;
