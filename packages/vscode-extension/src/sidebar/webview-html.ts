import * as vscode from 'vscode';

function nonce(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let result = '';
  for (let i = 0; i < 32; i++) result += chars.charAt(Math.floor(Math.random() * chars.length));
  return result;
}

/**
 * Renders the sidebar panel. Uses VS Code's built-in CSS variables
 * (--vscode-*) rather than hardcoded colors so it matches the user's theme
 * automatically, and a nonce-scoped CSP since the panel needs an inline
 * <script> for the (fairly small) amount of interactivity involved.
 */
export function getHtml(webview: vscode.Webview): string {
  const cspNonce = nonce();

  return /* html */ `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${cspNonce}';" />
<style>
  body {
    font-family: var(--vscode-font-family);
    color: var(--vscode-foreground);
    padding: 0 12px 16px;
    font-size: 13px;
  }
  h2 { font-size: 11px; text-transform: uppercase; letter-spacing: 0.05em; color: var(--vscode-descriptionForeground); margin: 18px 0 6px; }
  section { margin-bottom: 4px; }
  .row { display: flex; align-items: center; gap: 6px; margin-bottom: 6px; }
  input[type="text"], input[type="password"] {
    width: 100%;
    box-sizing: border-box;
    background: var(--vscode-input-background);
    color: var(--vscode-input-foreground);
    border: 1px solid var(--vscode-input-border, transparent);
    padding: 4px 6px;
    border-radius: 2px;
  }
  button {
    background: var(--vscode-button-background);
    color: var(--vscode-button-foreground);
    border: none;
    padding: 4px 10px;
    border-radius: 2px;
    cursor: pointer;
  }
  button:hover:not(:disabled) { background: var(--vscode-button-hoverBackground); }
  button:disabled { opacity: 0.5; cursor: not-allowed; }
  button.secondary { background: var(--vscode-button-secondaryBackground); color: var(--vscode-button-secondaryForeground); }
  .hidden { display: none; }
  .status-dot::before { content: '●'; margin-right: 5px; }
  .status-dot.ok { color: var(--vscode-testing-iconPassed, #2ea043); }
  .status-dot.pending { color: var(--vscode-testing-iconQueued, #cca700); }
  .result { font-size: 12px; color: var(--vscode-descriptionForeground); margin-top: 4px; }
  .result.ok { color: var(--vscode-testing-iconPassed, #2ea043); }
  .result.error { color: var(--vscode-testing-iconFailed, #f14c4c); }
  .confirm-row { display: flex; align-items: flex-start; gap: 6px; margin: 6px 0; font-size: 12px; color: var(--vscode-descriptionForeground); }
  #activity-log {
    max-height: 160px;
    overflow-y: auto;
    background: var(--vscode-textCodeBlock-background);
    border-radius: 2px;
    padding: 6px 8px;
    font-family: var(--vscode-editor-font-family, monospace);
    font-size: 11px;
  }
  .log-entry { padding: 1px 0; word-break: break-word; }
  .workspace-name { font-size: 12px; color: var(--vscode-descriptionForeground); margin-bottom: 10px; }
</style>
</head>
<body>
  <div class="workspace-name" id="workspace-name">Loading...</div>

  <h2>Credentials</h2>
  <section>
    <div class="row">
      <span class="status-dot pending" id="figma-token-status">Figma token not set</span>
      <button class="secondary" id="figma-token-toggle">Set</button>
    </div>
    <div class="row hidden" id="figma-token-form">
      <input type="password" id="figma-token-input" placeholder="Figma personal access token" />
      <button id="figma-token-save">Save</button>
    </div>
    <div class="row">
      <span class="status-dot pending" id="ai-key-status">AI key not set</span>
      <button class="secondary" id="ai-key-toggle">Set</button>
    </div>
    <div class="row hidden" id="ai-key-form">
      <input type="password" id="ai-key-input" placeholder="AI provider API key" />
      <button id="ai-key-save">Save</button>
    </div>
  </section>

  <h2>1. Analyze Flutter Project</h2>
  <section>
    <button id="analyze-btn">Analyze Project</button>
    <div class="result" id="analyze-result">Not analyzed yet</div>
  </section>

  <h2>2. Import Figma File</h2>
  <section>
    <div class="row">
      <input type="text" id="figma-url-input" placeholder="https://www.figma.com/design/..." />
    </div>
    <button id="import-btn">Import</button>
    <div class="result" id="import-result">Not imported yet</div>
  </section>

  <h2>3. Generate Plan</h2>
  <section>
    <button id="plan-btn" disabled>Generate Implementation Plan</button>
    <div class="result" id="plan-result">No plan yet</div>
  </section>

  <h2>4. Generate UI Code</h2>
  <section>
    <div class="confirm-row">
      <input type="checkbox" id="generate-confirm-checkbox" />
      <label for="generate-confirm-checkbox">I understand this writes files into my project (existing files are backed up as .bak)</label>
    </div>
    <button id="generate-btn" disabled>Generate UI Code</button>
    <div class="result" id="generate-result"></div>
  </section>

  <h2>5. Validate</h2>
  <section>
    <button id="validate-btn">Validate Generated Code</button>
    <div class="result" id="validate-result">Issues appear in the Problems panel</div>
  </section>

  <h2>6. Sync</h2>
  <section>
    <button id="sync-btn">Sync Changes</button>
    <div class="result" id="sync-result"></div>
  </section>

  <h2>Activity Log</h2>
  <div id="activity-log"></div>

<script nonce="${cspNonce}">
  const vscode = acquireVsCodeApi();
  const $ = (id) => document.getElementById(id);

  function logActivity(text) {
    const entry = document.createElement('div');
    entry.className = 'log-entry';
    entry.textContent = text;
    const log = $('activity-log');
    log.insertBefore(entry, log.firstChild);
  }

  function setStatusDot(id, ok, okText, notOkText) {
    const el = $(id);
    el.textContent = ok ? okText : notOkText;
    el.className = 'status-dot ' + (ok ? 'ok' : 'pending');
  }

  let latestState = {};

  function renderState(state) {
    latestState = state;
    $('workspace-name').textContent = state.workspaceFolderName ? 'Workspace: ' + state.workspaceFolderName : 'No workspace folder open';

    setStatusDot('figma-token-status', state.hasFigmaToken, 'Figma token set', 'Figma token not set');
    setStatusDot('ai-key-status', state.hasAiApiKey, 'AI key set', 'AI key not set');

    $('analyze-result').textContent = state.projectGraph
      ? state.projectGraph.widgetCount + ' widget(s), architecture: ' + state.projectGraph.architecturePattern
      : 'Not analyzed yet';

    $('import-result').textContent = state.designGraph
      ? '"' + state.designGraph.fileName + '" — ' + state.designGraph.pageCount + ' page(s), ' + state.designGraph.componentCount + ' component(s)'
      : 'Not imported yet';

    $('plan-btn').disabled = !(state.designGraph && state.projectGraph);
    $('plan-result').textContent = state.plan
      ? state.plan.widgetsToReuse + ' reuse, ' + state.plan.widgetsToUpdate + ' update, ' + state.plan.widgetsToCreate + ' create'
      : 'No plan yet';

    $('generate-btn').disabled = !(state.plan && $('generate-confirm-checkbox').checked);
  }

  const RESULT_ELEMENT_BY_COMMAND = {
    importFigmaFile: 'import-result',
    analyzeProject: 'analyze-result',
    generatePlan: 'plan-result',
    generateUI: 'generate-result',
    validateCode: 'validate-result',
    syncChanges: 'sync-result',
  };

  window.addEventListener('message', (event) => {
    const msg = event.data;
    if (msg.type === 'state') {
      renderState(msg.data);
    } else if (msg.type === 'progress') {
      logActivity('[' + msg.percentage + '%] ' + msg.message);
    } else if (msg.type === 'result') {
      logActivity((msg.ok ? 'v ' : 'x ') + msg.message);
      const elId = RESULT_ELEMENT_BY_COMMAND[msg.command];
      if (elId) {
        const el = $(elId);
        el.textContent = msg.message;
        el.className = 'result ' + (msg.ok ? 'ok' : 'error');
      }
    }
  });

  $('figma-token-toggle').addEventListener('click', () => $('figma-token-form').classList.toggle('hidden'));
  $('figma-token-save').addEventListener('click', () => {
    const token = $('figma-token-input').value;
    if (!token) return;
    vscode.postMessage({ type: 'setFigmaToken', token });
    $('figma-token-input').value = '';
    $('figma-token-form').classList.add('hidden');
  });

  $('ai-key-toggle').addEventListener('click', () => $('ai-key-form').classList.toggle('hidden'));
  $('ai-key-save').addEventListener('click', () => {
    const key = $('ai-key-input').value;
    if (!key) return;
    vscode.postMessage({ type: 'setAiApiKey', key });
    $('ai-key-input').value = '';
    $('ai-key-form').classList.add('hidden');
  });

  $('analyze-btn').addEventListener('click', () => vscode.postMessage({ type: 'analyzeProject' }));

  $('import-btn').addEventListener('click', () => {
    const url = $('figma-url-input').value;
    if (!url) return;
    vscode.postMessage({ type: 'importFigmaFile', url });
  });

  $('plan-btn').addEventListener('click', () => vscode.postMessage({ type: 'generatePlan' }));

  $('generate-confirm-checkbox').addEventListener('change', () => {
    $('generate-btn').disabled = !(latestState.plan && $('generate-confirm-checkbox').checked);
  });
  $('generate-btn').addEventListener('click', () => {
    vscode.postMessage({ type: 'generateUI', confirmed: $('generate-confirm-checkbox').checked });
  });

  $('validate-btn').addEventListener('click', () => vscode.postMessage({ type: 'validateCode' }));
  $('sync-btn').addEventListener('click', () => vscode.postMessage({ type: 'syncChanges' }));

  vscode.postMessage({ type: 'requestState' });
</script>
</body>
</html>`;
}
