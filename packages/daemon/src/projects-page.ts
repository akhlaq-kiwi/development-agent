export const PROJECTS_HTML = `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Builder — Projects</title>
<style>
  body { font-family: -apple-system, sans-serif; margin: 2rem; background: #0d1117; color: #e6edf3; }
  .header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem; }
  h1 { font-size: 1.3rem; margin: 0; }
  button, a.btn { padding: 0.5rem 1rem; background: #238636; color: white; border: none; border-radius: 6px; cursor: pointer; font-size: 0.85rem; text-decoration: none; display: inline-block; }
  button:hover, a.btn:hover { background: #2ea043; }
  .btn-secondary { background: #21262d; border: 1px solid #30363d; color: #e6edf3; }
  .btn-secondary:hover { background: #30363d; }
  .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); gap: 1rem; }
  .card { border: 1px solid #30363d; border-radius: 10px; padding: 1.1rem; background: #161b22; display: flex; flex-direction: column; gap: 0.6rem; }
  .card .name { font-weight: 600; font-size: 1rem; }
  .card .path { font-size: 0.75rem; color: #6e7681; font-family: monospace; word-break: break-all; }
  .pill { display: inline-block; padding: 0.15rem 0.55rem; border-radius: 10px; font-size: 0.7rem; width: fit-content; }
  .pill-running { background: #113a1f; color: #3fb950; }
  .pill-idle { background: #21262d; color: #9198a1; }
  .pill-unconfigured { background: #3d2a0a; color: #d29922; }
  .card .actions { display: flex; gap: 0.5rem; margin-top: auto; }
  #empty { color: #6e7681; font-size: 0.9rem; margin-top: 3rem; text-align: center; }

  .modal-overlay { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); align-items: center; justify-content: center; }
  .modal-overlay.open { display: flex; }
  .modal { background: #161b22; border: 1px solid #30363d; border-radius: 10px; padding: 1.5rem; width: 320px; }
  .modal h2 { font-size: 1rem; margin: 0 0 1rem; }
  .modal input { width: 100%; box-sizing: border-box; padding: 0.5rem 0.6rem; background: #0d1117; color: #e6edf3; border: 1px solid #30363d; border-radius: 6px; font-size: 0.9rem; margin-bottom: 0.8rem; }
  .modal .row { display: flex; gap: 0.5rem; justify-content: flex-end; }
  #modalStatus { font-size: 0.8rem; color: #f85149; margin-bottom: 0.5rem; }
</style>
</head>
<body>
  <div class="header">
    <h1>Builder — Projects</h1>
    <button id="newProjectBtn">+ New Project</button>
  </div>

  <div id="grid" class="grid"></div>
  <div id="empty" style="display:none;">No projects yet — click "+ New Project" to add one.</div>

  <div class="modal-overlay" id="modalOverlay">
    <div class="modal">
      <h2>New Project</h2>
      <div id="modalStatus"></div>
      <input id="nameInput" placeholder="Project name" autofocus />
      <div class="row">
        <button class="btn-secondary" id="cancelBtn" type="button">Cancel</button>
        <button id="createBtn" type="button">Create</button>
      </div>
    </div>
  </div>

<script>
const grid = document.getElementById('grid');
const emptyEl = document.getElementById('empty');
const overlay = document.getElementById('modalOverlay');
const nameInput = document.getElementById('nameInput');
const modalStatus = document.getElementById('modalStatus');

function formatCountdown(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return m + ':' + String(s).padStart(2, '0');
}

function render(projects) {
  emptyEl.style.display = projects.length ? 'none' : 'block';
  grid.innerHTML = projects.map(p => {
    let pill;
    if (!p.configured) pill = '<span class="pill pill-unconfigured">not configured</span>';
    else if (p.running) pill = '<span class="pill pill-running">running' + (p.nextCheckAt ? ' · next check ' + formatCountdown(p.nextCheckAt - Date.now()) : '') + '</span>';
    else pill = '<span class="pill pill-idle">idle</span>';
    const openHref = p.configured
      ? '/?workspaceId=' + encodeURIComponent(p.id)
      : '/config?workspaceId=' + encodeURIComponent(p.id);
    const openLabel = p.configured ? 'Open' : 'Configure';
    return \`<div class="card">
      <div class="name">\${p.name}</div>
      <div class="path">\${p.projectDir || '(no path set yet)'}</div>
      \${pill}
      <div class="actions">
        <a class="btn" href="\${openHref}">\${openLabel}</a>
        <a class="btn btn-secondary" href="/config?workspaceId=\${encodeURIComponent(p.id)}">Settings</a>
      </div>
    </div>\`;
  }).join('');
}

async function load() {
  const res = await fetch('/workspaces');
  render(await res.json());
}
load();
setInterval(load, 3000);

function openModal() {
  overlay.classList.add('open');
  modalStatus.textContent = '';
  nameInput.value = '';
  nameInput.focus();
}
function closeModal() {
  overlay.classList.remove('open');
}

document.getElementById('newProjectBtn').addEventListener('click', openModal);
document.getElementById('cancelBtn').addEventListener('click', closeModal);
overlay.addEventListener('click', (e) => { if (e.target === overlay) closeModal(); });

async function createProject() {
  const name = nameInput.value.trim();
  if (!name) {
    modalStatus.textContent = 'Enter a project name.';
    return;
  }
  const res = await fetch('/workspaces', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  if (res.ok) {
    const ws = await res.json();
    location.href = '/config?workspaceId=' + encodeURIComponent(ws.id);
  } else {
    const err = await res.json();
    modalStatus.textContent = 'Error: ' + err.error;
  }
}
document.getElementById('createBtn').addEventListener('click', createProject);
nameInput.addEventListener('keydown', (e) => { if (e.key === 'Enter') createProject(); });
</script>
</body>
</html>
`;
