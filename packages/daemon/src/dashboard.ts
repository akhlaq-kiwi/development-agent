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
  #log { font-family: monospace; font-size: 0.8rem; white-space: pre-wrap; max-height: 40vh; overflow-y: auto; background: #161b22; padding: 1rem; border-radius: 6px; }
</style>
</head>
<body>
  <h1>Builder — Work Items <a id="configLink" href="#" style="font-size: 0.8rem; float: right;">Config</a></h1>
  <table id="items"><thead><tr><th>Status</th><th>Provider</th><th>ID</th><th>Title</th><th>Updated</th></tr></thead><tbody></tbody></table>
  <h1>Live Log</h1>
  <div id="log"></div>
<script>
const params = new URLSearchParams(location.search);
const projectDir = params.get('projectDir') || '';
document.getElementById('configLink').href = '/config?projectDir=' + encodeURIComponent(projectDir);

async function loadItems() {
  const res = await fetch('/work-items');
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

const log = document.getElementById('log');
const ws = new WebSocket(\`ws://\${location.host}/stream\`);
ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  if (data.type === 'event') {
    const e = data.event;
    log.textContent += \`\${new Date(e.ts).toLocaleTimeString()} [\${e.stage}] \${e.message}\\n\`;
    log.scrollTop = log.scrollHeight;
    loadItems();
  }
};
</script>
</body>
</html>
`;
