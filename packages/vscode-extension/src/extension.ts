/**
 * Design Intelligence VS Code Extension
 * 
 * Main entry point for the VS Code extension.
 * Provides a thin UI layer over the core engine.
 */

import * as vscode from 'vscode';
import { Logger, LoggingConfig, createLogger } from '@design-intelligence/core';

let logger: Logger;

export function activate(context: vscode.ExtensionContext): void {
  // Initialize logger
  const config = vscode.workspace.getConfiguration('designIntelligence');
  const loggingConfig: LoggingConfig = {
    level: (config.get('logLevel') as 'debug' | 'info' | 'warn' | 'error') || 'info',
    toConsole: true,
    toFile: false,
    filePath: undefined,
  };
  logger = createLogger(loggingConfig, 'DI-Extension');

  logger.info('Design Intelligence extension activated');

  // Register commands
  registerCommands(context);
}

function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('di.reload', () => {
      logger.info('Extension reloaded');
      vscode.window.showInformationMessage('Design Intelligence extension reloaded');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.importFigmaFile', async () => {
      const url = await vscode.window.showInputBox({
        prompt: 'Enter Figma file URL',
        placeHolder: 'https://www.figma.com/file/...',
        validateInput: (value: string) => (!value ? 'URL is required' : ''),
      });

      if (!url) return;

      logger.info(`Importing Figma file: ${url}`);
      vscode.window.showInformationMessage('Figma import initiated. This feature requires configuration.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.analyzeProject', async () => {
      const folder = vscode.workspace.workspaceFolders?.[0];
      
      if (!folder) {
        vscode.window.showErrorMessage('No workspace folder open');
        return;
      }

      logger.info(`Analyzing project: ${folder.uri.fsPath}`);
      
      vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Analyzing Flutter project...',
        cancellable: false,
      }, async (progress: vscode.Progress<{ increment: number }>) => {
        progress.report({ increment: 50 });
        await new Promise(resolve => setTimeout(resolve, 2000));
        progress.report({ increment: 50 });
      });

      vscode.window.showInformationMessage('Project analysis initiated. This feature requires configuration.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.generatePlan', async () => {
      logger.info('Generating implementation plan');
      vscode.window.showInformationMessage('Plan generation initiated. This feature requires configuration.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.generateUI', async () => {
      logger.info('Generating UI code');
      vscode.window.showInformationMessage('UI generation initiated. This feature requires configuration.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.validateCode', async () => {
      logger.info('Validating code');
      vscode.window.showInformationMessage('Validation initiated. This feature requires configuration.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.syncChanges', async () => {
      logger.info('Syncing changes');
      vscode.window.showInformationMessage('Sync initiated. This feature requires configuration.');
    })
  );
}

export function deactivate(): void {
  logger.info('Design Intelligence extension deactivated');
}