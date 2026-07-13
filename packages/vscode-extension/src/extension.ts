/**
 * Design Intelligence VS Code Extension
 *
 * Main entry point for the VS Code extension. Both the Command Palette
 * commands here and the sidebar webview (sidebar/) are thin UI layers over
 * the shared action functions in actions.ts.
 */

import * as vscode from 'vscode';
import { Logger, LoggingConfig, createLogger } from '@design-intelligence/core';
import * as actions from './actions';
import { ProgressCallback, ActionResult } from './actions';
import { DesignIntelligenceViewProvider } from './sidebar/design-intelligence-view-provider';

let logger: Logger;

export function activate(context: vscode.ExtensionContext): void {
  const vsConfig = vscode.workspace.getConfiguration('designIntelligence');
  const loggingConfig: LoggingConfig = {
    level: (vsConfig.get('logLevel') as LoggingConfig['level']) || 'info',
    toConsole: true,
    toFile: false,
  };
  logger = createLogger(loggingConfig, 'DI-Extension');
  logger.info('Design Intelligence extension activated');

  const diagnostics = vscode.languages.createDiagnosticCollection('design-intelligence');
  context.subscriptions.push(diagnostics);

  const sidebarProvider = new DesignIntelligenceViewProvider(context, logger, diagnostics);
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(DesignIntelligenceViewProvider.viewType, sidebarProvider)
  );

  registerCommands(context, diagnostics);
}

export function deactivate(): void {
  logger.info('Design Intelligence extension deactivated');
}

/** Runs an action inside a real VS Code progress notification, fed by the action's own progress callback. */
function runWithProgress<T>(title: string, action: (onProgress: ProgressCallback) => Promise<ActionResult<T>>): Thenable<ActionResult<T>> {
  return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title, cancellable: false }, async progress => {
    let lastPercentage = 0;
    return action((message, percentage) => {
      progress.report({ increment: percentage - lastPercentage, message });
      lastPercentage = percentage;
    });
  });
}

function requireWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) vscode.window.showErrorMessage('No workspace folder open');
  return folder;
}

function showResult(result: ActionResult): void {
  if (result.ok) vscode.window.showInformationMessage(result.message);
  else vscode.window.showErrorMessage(result.message);
}

function registerCommands(context: vscode.ExtensionContext, diagnostics: vscode.DiagnosticCollection): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('di.reload', () => {
      actions.resetState();
      logger.info('Extension reloaded');
      vscode.window.showInformationMessage('Design Intelligence extension reloaded');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.setFigmaToken', async () => {
      const token = await vscode.window.showInputBox({ prompt: 'Figma personal access token', password: true, ignoreFocusOut: true });
      if (!token) return;
      showResult(await actions.setFigmaToken(context, token));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.setAiApiKey', async () => {
      const key = await vscode.window.showInputBox({
        prompt: 'AI provider API key (Anthropic / OpenAI / custom, matching your di.config.json ai.provider)',
        password: true,
        ignoreFocusOut: true,
      });
      if (!key) return;
      showResult(await actions.setAiApiKey(context, key));
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.importFigmaFile', async () => {
      const folder = requireWorkspaceFolder();
      if (!folder) return;

      const url = await vscode.window.showInputBox({
        prompt: 'Enter Figma file URL',
        placeHolder: 'https://www.figma.com/file/...',
        ignoreFocusOut: true,
        validateInput: (value: string) => (value ? null : 'URL is required'),
      });
      if (!url) return;

      const config = await actions.loadConfig(context, folder);
      if (!config.figma.accessToken) {
        const action = await vscode.window.showErrorMessage('No Figma access token configured.', 'Set Token Now');
        if (action === 'Set Token Now') await vscode.commands.executeCommand('design-intelligence.setFigmaToken');
        return;
      }

      const result = await runWithProgress('Importing Figma file...', onProgress => actions.importFigmaFile(context, folder, url, logger, onProgress));
      showResult(result);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.analyzeProject', async () => {
      const folder = requireWorkspaceFolder();
      if (!folder) return;

      const result = await runWithProgress('Analyzing Flutter project...', onProgress => actions.analyzeProject(context, folder, logger, onProgress));
      showResult(result);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.generatePlan', async () => {
      const folder = requireWorkspaceFolder();
      if (!folder) return;

      const result = await runWithProgress('Generating implementation plan...', onProgress => actions.generatePlan(context, folder, logger, onProgress));
      showResult(result);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.generateUI', async () => {
      const folder = requireWorkspaceFolder();
      if (!folder) return;

      const config = await actions.loadConfig(context, folder);
      if (!config.ai.apiKey) {
        const action = await vscode.window.showErrorMessage('No AI provider API key configured.', 'Set Key Now');
        if (action === 'Set Key Now') await vscode.commands.executeCommand('design-intelligence.setAiApiKey');
        return;
      }

      const confirmation = await vscode.window.showWarningMessage(
        'This will generate Flutter code from the current plan and write it into your project (existing files are backed up as .bak). Continue?',
        { modal: true },
        'Generate'
      );
      if (confirmation !== 'Generate') return;

      const result = await runWithProgress('Generating UI code...', onProgress => actions.generateUI(context, folder, logger, onProgress));
      showResult(result);
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.validateCode', async () => {
      const folder = requireWorkspaceFolder();
      if (!folder) return;

      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Validating generated code...' }, async () => {
        const result = await actions.validateCode(context, folder, logger);
        if (result.data) actions.populateDiagnostics(diagnostics, folder, result.data);
        showResult(result);
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.syncChanges', async () => {
      const folder = requireWorkspaceFolder();
      if (!folder) return;

      showResult(await actions.syncChanges(context, folder, logger));
    })
  );
}
