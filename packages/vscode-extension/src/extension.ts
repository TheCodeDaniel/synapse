/**
 * Design Intelligence VS Code Extension
 *
 * Main entry point for the VS Code extension.
 * Provides a thin UI layer over the core engine's Pipeline.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  Logger,
  LoggingConfig,
  createLogger,
  loadOrCreateConfig,
  CoreConfig,
  Pipeline,
  CoreEvent,
  validateFigmaUrl,
  extractFigmaKey,
  serializeDesignGraph,
  deserializeDesignGraph,
  serializeProjectGraph,
  deserializeProjectGraph,
  DesignGraph,
  ProjectGraph,
} from '@design-intelligence/core';

let logger: Logger;
// A single Pipeline instance is reused across commands within one workspace
// so state (imported design graph, analyzed project graph, generated plan)
// threads from one command to the next, matching how the commands are
// documented to be used together (import -> analyze -> plan -> generate).
let pipeline: Pipeline | undefined;
let currentConfig: CoreConfig | undefined;

// Secrets never touch di.config.json or any file on disk — they're read
// from VS Code's SecretStorage (OS keychain-backed) and injected into the
// in-memory config after it's loaded.
const FIGMA_TOKEN_SECRET_KEY = 'designIntelligence.figmaAccessToken';
const AI_API_KEY_SECRET_KEY = 'designIntelligence.aiApiKey';

export function activate(context: vscode.ExtensionContext): void {
  const vsConfig = vscode.workspace.getConfiguration('designIntelligence');
  const loggingConfig: LoggingConfig = {
    level: (vsConfig.get('logLevel') as LoggingConfig['level']) || 'info',
    toConsole: true,
    toFile: false,
  };
  logger = createLogger(loggingConfig, 'DI-Extension');
  logger.info('Design Intelligence extension activated');

  registerCommands(context);
}

export function deactivate(): void {
  logger.info('Design Intelligence extension deactivated');
}

function designGraphPath(config: CoreConfig): string {
  return path.join(config.storage.path ?? '.', 'design-graph.json');
}

function projectGraphPath(config: CoreConfig): string {
  return path.join(config.storage.path ?? '.', 'project-graph.json');
}

async function loadConfig(context: vscode.ExtensionContext, folder: vscode.WorkspaceFolder): Promise<CoreConfig> {
  const config = loadOrCreateConfig(folder.uri.fsPath);

  const figmaToken = await context.secrets.get(FIGMA_TOKEN_SECRET_KEY);
  if (figmaToken) config.figma.accessToken = figmaToken;

  const aiApiKey = await context.secrets.get(AI_API_KEY_SECRET_KEY);
  if (aiApiKey) config.ai.apiKey = aiApiKey;

  return config;
}

/** Returns the shared Pipeline for this project, restoring previously-persisted graphs if this is a fresh instance (e.g. after a window reload). */
function getPipeline(config: CoreConfig): Pipeline {
  if (pipeline && currentConfig?.projectName === config.projectName) {
    return pipeline;
  }

  pipeline = new Pipeline(config, { logger });
  currentConfig = config;

  try {
    const dGraphPath = designGraphPath(config);
    if (fs.existsSync(dGraphPath)) {
      pipeline.state.designGraph = deserializeDesignGraph(JSON.parse(fs.readFileSync(dGraphPath, 'utf-8')));
    }
    const pGraphPath = projectGraphPath(config);
    if (fs.existsSync(pGraphPath)) {
      pipeline.state.projectGraph = deserializeProjectGraph(JSON.parse(fs.readFileSync(pGraphPath, 'utf-8')));
    }
  } catch (error) {
    // Corrupt/unreadable persisted state — commands that need it will
    // surface a clear "import/analyze first" error instead.
    logger.warn('Failed to restore persisted graphs', error instanceof Error ? error.message : String(error));
  }

  return pipeline;
}

function persistDesignGraph(config: CoreConfig, graph: DesignGraph): void {
  const filePath = designGraphPath(config);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(serializeDesignGraph(graph)), 'utf-8');
}

function persistProjectGraph(config: CoreConfig, graph: ProjectGraph): void {
  const filePath = projectGraphPath(config);
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, JSON.stringify(serializeProjectGraph(graph)), 'utf-8');
}

/** Runs a Pipeline-driven task inside a real VS Code progress notification, fed by the Pipeline's own `progress` CoreEvents. */
function withPipelineProgress<T>(title: string, pipelineInstance: Pipeline, task: () => Promise<T>): Thenable<T> {
  return vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title, cancellable: false }, async progress => {
    let lastPercentage = 0;
    const unsubscribe = pipelineInstance.on((event: CoreEvent) => {
      if (event.type === 'progress') {
        progress.report({ increment: event.percentage - lastPercentage, message: event.message });
        lastPercentage = event.percentage;
      }
    });

    try {
      return await task();
    } finally {
      unsubscribe();
    }
  });
}

function requireWorkspaceFolder(): vscode.WorkspaceFolder | undefined {
  const folder = vscode.workspace.workspaceFolders?.[0];
  if (!folder) vscode.window.showErrorMessage('No workspace folder open');
  return folder;
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function registerCommands(context: vscode.ExtensionContext): void {
  context.subscriptions.push(
    vscode.commands.registerCommand('di.reload', () => {
      pipeline = undefined;
      currentConfig = undefined;
      logger.info('Extension reloaded');
      vscode.window.showInformationMessage('Design Intelligence extension reloaded');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.setFigmaToken', async () => {
      const token = await vscode.window.showInputBox({ prompt: 'Figma personal access token', password: true, ignoreFocusOut: true });
      if (!token) return;
      await context.secrets.store(FIGMA_TOKEN_SECRET_KEY, token);
      vscode.window.showInformationMessage('Figma access token saved securely.');
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
      await context.secrets.store(AI_API_KEY_SECRET_KEY, key);
      vscode.window.showInformationMessage('AI provider API key saved securely.');
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.importFigmaFile', async () => {
      const folder = requireWorkspaceFolder();
      if (!folder) return;

      const url = await vscode.window.showInputBox({
        prompt: 'Enter Figma file URL',
        placeHolder: 'https://www.figma.com/file/...',
        validateInput: (value: string) => {
          if (!value) return 'URL is required';
          if (!validateFigmaUrl(value)) return 'This does not look like a figma.com URL';
          if (!extractFigmaKey(value)) return 'Could not find a file key in this URL';
          return null;
        },
      });
      if (!url) return;
      const fileKey = extractFigmaKey(url)!;

      const config = await loadConfig(context, folder);
      if (!config.figma.accessToken) {
        const action = await vscode.window.showErrorMessage(
          'No Figma access token configured.',
          'Set Token Now'
        );
        if (action === 'Set Token Now') await vscode.commands.executeCommand('design-intelligence.setFigmaToken');
        return;
      }

      try {
        const pipelineInstance = getPipeline(config);
        const designGraph = await withPipelineProgress('Importing Figma file...', pipelineInstance, () =>
          pipelineInstance.importFigmaFile(fileKey)
        );
        persistDesignGraph(config, designGraph);

        logger.info(`Imported Figma file ${fileKey}: ${designGraph.pages.length} page(s)`);
        vscode.window.showInformationMessage(
          `Imported "${designGraph.fileName}" — ${designGraph.pages.length} page(s), ${designGraph.components.size} component(s).`
        );
      } catch (error) {
        logger.error('Figma import failed', describeError(error));
        vscode.window.showErrorMessage(`Figma import failed: ${describeError(error)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.analyzeProject', async () => {
      const folder = requireWorkspaceFolder();
      if (!folder) return;

      const config = await loadConfig(context, folder);
      config.flutter.projectPath = folder.uri.fsPath;

      try {
        const pipelineInstance = getPipeline(config);
        const projectGraph = await withPipelineProgress('Analyzing Flutter project...', pipelineInstance, () =>
          pipelineInstance.analyzeProject()
        );
        persistProjectGraph(config, projectGraph);

        vscode.window.showInformationMessage(
          `Analyzed project — ${projectGraph.widgets.size} widget(s), architecture: ${projectGraph.architecture.pattern}.`
        );
      } catch (error) {
        logger.error('Project analysis failed', describeError(error));
        vscode.window.showErrorMessage(`Project analysis failed: ${describeError(error)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.generatePlan', async () => {
      const folder = requireWorkspaceFolder();
      if (!folder) return;
      const config = await loadConfig(context, folder);

      try {
        const pipelineInstance = getPipeline(config);
        const plan = await withPipelineProgress('Generating implementation plan...', pipelineInstance, () =>
          pipelineInstance.generatePlan()
        );

        vscode.window.showInformationMessage(
          `Plan ready — ${plan.summary.widgetsToReuse} to reuse, ${plan.summary.widgetsToUpdate} to update, ${plan.summary.widgetsToCreate} to create.`
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Could not generate plan: ${describeError(error)}`);
      }
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.generateUI', async () => {
      const folder = requireWorkspaceFolder();
      if (!folder) return;
      const config = await loadConfig(context, folder);

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

      try {
        const pipelineInstance = getPipeline(config);
        const results = await withPipelineProgress('Generating UI code...', pipelineInstance, () => pipelineInstance.generateUI());
        const succeeded = results.filter(r => r.success);

        const integration = await pipelineInstance.integrateFiles(succeeded.map(r => ({ filePath: r.filePath, content: r.content ?? '' })));

        vscode.window.showInformationMessage(
          `Generated ${succeeded.length}/${results.length} widget(s). Wrote ${integration.filesCreated} new file(s), updated ${integration.filesModified}.`
        );
        if (results.length !== succeeded.length) {
          logger.warn('Some generation tasks failed', JSON.stringify(results.filter(r => !r.success)));
        }
      } catch (error) {
        vscode.window.showErrorMessage(`UI generation failed: ${describeError(error)}`);
      }
    })
  );

  const diagnostics = vscode.languages.createDiagnosticCollection('design-intelligence');
  context.subscriptions.push(diagnostics);

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.validateCode', async () => {
      const folder = requireWorkspaceFolder();
      if (!folder) return;
      const config = await loadConfig(context, folder);
      config.flutter.projectPath = folder.uri.fsPath;

      await vscode.window.withProgress({ location: vscode.ProgressLocation.Notification, title: 'Validating generated code...' }, async () => {
        const pipelineInstance = getPipeline(config);
        const result = pipelineInstance.validateCode();

        diagnostics.clear();
        const byFile = new Map<string, vscode.Diagnostic[]>();
        for (const err of result.errors) {
          if (!err.file) continue;
          const filePath = path.isAbsolute(err.file) ? err.file : path.join(folder.uri.fsPath, err.file);
          const line = Math.max((err.line ?? 1) - 1, 0);
          const column = Math.max((err.column ?? 1) - 1, 0);
          const range = new vscode.Range(line, column, line, column + 1);
          const severity = err.severity === 'error' ? vscode.DiagnosticSeverity.Error : vscode.DiagnosticSeverity.Warning;

          const list = byFile.get(filePath) ?? [];
          list.push(new vscode.Diagnostic(range, err.message, severity));
          byFile.set(filePath, list);
        }
        for (const [filePath, list] of byFile) {
          diagnostics.set(vscode.Uri.file(filePath), list);
        }

        if (result.passed) {
          vscode.window.showInformationMessage('Validation passed — no issues found.');
        } else {
          vscode.window.showWarningMessage(`Validation found ${result.errors.length} issue(s). See the Problems panel.`);
        }
      });
    })
  );

  context.subscriptions.push(
    vscode.commands.registerCommand('design-intelligence.syncChanges', async () => {
      const folder = requireWorkspaceFolder();
      if (!folder) return;
      const config = await loadConfig(context, folder);
      config.flutter.projectPath = folder.uri.fsPath;

      try {
        const pipelineInstance = getPipeline(config);
        const relevantTaskIds = await pipelineInstance.syncChanges(
          designGraphPath(config),
          projectGraphPath(config),
          path.join(config.storage.path ?? '.', 'sync-cache')
        );

        vscode.window.showInformationMessage(
          relevantTaskIds.length > 0
            ? `Sync found ${relevantTaskIds.length} task(s) that need regenerating.`
            : 'Sync found no changes since the last run.'
        );
      } catch (error) {
        vscode.window.showErrorMessage(`Sync failed: ${describeError(error)}`);
      }
    })
  );
}
