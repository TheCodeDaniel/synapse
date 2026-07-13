/**
 * Sidebar webview — a persistent Activity Bar panel that walks through the
 * same steps as the Command Palette commands (actions.ts), but as inline
 * inputs/buttons that stay visible instead of one-shot Quick Input popups.
 */

import * as vscode from 'vscode';
import { Logger } from '@design-intelligence/core';
import * as actions from '../actions';
import { getHtml } from './webview-html';

type IncomingMessage =
  | { type: 'requestState' }
  | { type: 'setFigmaToken'; token: string }
  | { type: 'setAiApiKey'; key: string }
  | { type: 'importFigmaFile'; url: string }
  | { type: 'analyzeProject' }
  | { type: 'generatePlan' }
  | { type: 'generateUI'; confirmed: boolean }
  | { type: 'validateCode' }
  | { type: 'syncChanges' };

export class DesignIntelligenceViewProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'design-intelligence.sidebar';

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly logger: Logger,
    private readonly diagnostics: vscode.DiagnosticCollection
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.options = { enableScripts: true };
    webviewView.webview.html = getHtml(webviewView.webview);

    webviewView.webview.onDidReceiveMessage((message: IncomingMessage) => this.handleMessage(message, webviewView.webview));

    // Populate the panel with current state as soon as it's shown, without
    // waiting for the webview's own onload 'requestState' round-trip.
    void this.pushStatus(webviewView.webview);
  }

  private requireWorkspaceFolder(webview: vscode.Webview): vscode.WorkspaceFolder | undefined {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (!folder) {
      webview.postMessage({ type: 'result', command: 'error', ok: false, message: 'No workspace folder open.' });
    }
    return folder;
  }

  private async pushStatus(webview: vscode.Webview): Promise<void> {
    const folder = vscode.workspace.workspaceFolders?.[0];
    const status = await actions.getStatus(this.context, folder, this.logger);
    webview.postMessage({ type: 'state', data: status });
  }

  private async handleMessage(message: IncomingMessage, webview: vscode.Webview): Promise<void> {
    const onProgress = (progressMessage: string, percentage: number) => {
      webview.postMessage({ type: 'progress', message: progressMessage, percentage });
    };

    switch (message.type) {
      case 'requestState': {
        await this.pushStatus(webview);
        return;
      }

      case 'setFigmaToken': {
        const result = await actions.setFigmaToken(this.context, message.token);
        webview.postMessage({ type: 'result', command: message.type, ...result });
        await this.pushStatus(webview);
        return;
      }

      case 'setAiApiKey': {
        const result = await actions.setAiApiKey(this.context, message.key);
        webview.postMessage({ type: 'result', command: message.type, ...result });
        await this.pushStatus(webview);
        return;
      }

      case 'importFigmaFile': {
        const folder = this.requireWorkspaceFolder(webview);
        if (!folder) return;
        const result = await actions.importFigmaFile(this.context, folder, message.url, this.logger, onProgress);
        webview.postMessage({ type: 'result', command: message.type, ...result });
        await this.pushStatus(webview);
        return;
      }

      case 'analyzeProject': {
        const folder = this.requireWorkspaceFolder(webview);
        if (!folder) return;
        const result = await actions.analyzeProject(this.context, folder, this.logger, onProgress);
        webview.postMessage({ type: 'result', command: message.type, ...result });
        await this.pushStatus(webview);
        return;
      }

      case 'generatePlan': {
        const folder = this.requireWorkspaceFolder(webview);
        if (!folder) return;
        const result = await actions.generatePlan(this.context, folder, this.logger, onProgress);
        webview.postMessage({ type: 'result', command: message.type, ...result });
        await this.pushStatus(webview);
        return;
      }

      case 'generateUI': {
        const folder = this.requireWorkspaceFolder(webview);
        if (!folder) return;
        // Defensive server-side check — the webview only lets the user send
        // this once the inline confirmation checkbox is ticked, but this
        // writes files to disk, so it's re-checked here rather than trusted.
        if (!message.confirmed) {
          webview.postMessage({ type: 'result', command: message.type, ok: false, message: 'Confirm before generating — this writes files to your project.' });
          return;
        }
        const result = await actions.generateUI(this.context, folder, this.logger, onProgress);
        webview.postMessage({ type: 'result', command: message.type, ...result });
        await this.pushStatus(webview);
        return;
      }

      case 'validateCode': {
        const folder = this.requireWorkspaceFolder(webview);
        if (!folder) return;
        const result = await actions.validateCode(this.context, folder, this.logger);
        if (result.data) actions.populateDiagnostics(this.diagnostics, folder, result.data);
        webview.postMessage({ type: 'result', command: message.type, ...result });
        return;
      }

      case 'syncChanges': {
        const folder = this.requireWorkspaceFolder(webview);
        if (!folder) return;
        const result = await actions.syncChanges(this.context, folder, this.logger);
        webview.postMessage({ type: 'result', command: message.type, ...result });
        return;
      }
    }
  }
}
