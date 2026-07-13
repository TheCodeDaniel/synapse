/**
 * Shared business logic for every Design Intelligence action — imported by
 * both the Command Palette commands (extension.ts) and the sidebar webview
 * (sidebar/design-intelligence-view-provider.ts), so the two UIs never
 * duplicate the actual work, only how they present it.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import {
  Logger,
  loadOrCreateConfig,
  CoreConfig,
  Pipeline,
  CoreEvent,
  DesignGraph,
  ProjectGraph,
  ImplementationPlan,
  GenerationResult,
  IntegrationResult,
  ValidationResult,
  validateFigmaUrl,
  extractFigmaKey,
  serializeDesignGraph,
  deserializeDesignGraph,
  serializeProjectGraph,
  deserializeProjectGraph,
} from '@design-intelligence/core';

export interface ActionResult<T = unknown> {
  ok: boolean;
  message: string;
  data?: T;
}

export type ProgressCallback = (message: string, percentage: number) => void;

export interface StatusSnapshot {
  workspaceFolderName?: string;
  hasFigmaToken: boolean;
  hasAiApiKey: boolean;
  designGraph?: { fileName: string; pageCount: number; componentCount: number };
  projectGraph?: { widgetCount: number; architecturePattern: string };
  plan?: { widgetsToReuse: number; widgetsToUpdate: number; widgetsToCreate: number };
}

// Secrets never touch di.config.json or any file on disk — they're read
// from VS Code's SecretStorage (OS keychain-backed) and injected into the
// in-memory config after it's loaded.
const FIGMA_TOKEN_SECRET_KEY = 'designIntelligence.figmaAccessToken';
const AI_API_KEY_SECRET_KEY = 'designIntelligence.aiApiKey';

// A single Pipeline instance is reused across actions within one workspace
// so state (imported design graph, analyzed project graph, generated plan)
// threads from one action to the next — regardless of whether it was
// triggered from a command or the sidebar.
let pipeline: Pipeline | undefined;
let currentConfig: CoreConfig | undefined;

/** Resets the in-memory Pipeline/config singleton (used by the `di.reload` command). */
export function resetState(): void {
  pipeline = undefined;
  currentConfig = undefined;
}

function designGraphPath(config: CoreConfig): string {
  return path.join(config.storage.path ?? '.', 'design-graph.json');
}

function projectGraphPath(config: CoreConfig): string {
  return path.join(config.storage.path ?? '.', 'project-graph.json');
}

export async function loadConfig(context: vscode.ExtensionContext, folder: vscode.WorkspaceFolder): Promise<CoreConfig> {
  const config = loadOrCreateConfig(folder.uri.fsPath);

  const figmaToken = await context.secrets.get(FIGMA_TOKEN_SECRET_KEY);
  if (figmaToken) config.figma.accessToken = figmaToken;

  const aiApiKey = await context.secrets.get(AI_API_KEY_SECRET_KEY);
  if (aiApiKey) config.ai.apiKey = aiApiKey;

  return config;
}

/** Returns the shared Pipeline for this project, restoring previously-persisted graphs if this is a fresh instance (e.g. after a window reload). */
function getPipeline(config: CoreConfig, logger: Logger): Pipeline {
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
    // Corrupt/unreadable persisted state — actions that need it will
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

export function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/** Wires a Pipeline's `progress` CoreEvents to a plain callback, decoupled from any particular UI (notification vs. webview). */
function wireProgress(pipelineInstance: Pipeline, onProgress?: ProgressCallback): () => void {
  if (!onProgress) return () => undefined;
  return pipelineInstance.on((event: CoreEvent) => {
    if (event.type === 'progress') onProgress(event.message, event.percentage);
  });
}

export async function setFigmaToken(context: vscode.ExtensionContext, token: string): Promise<ActionResult> {
  await context.secrets.store(FIGMA_TOKEN_SECRET_KEY, token);
  return { ok: true, message: 'Figma access token saved securely.' };
}

export async function setAiApiKey(context: vscode.ExtensionContext, key: string): Promise<ActionResult> {
  await context.secrets.store(AI_API_KEY_SECRET_KEY, key);
  return { ok: true, message: 'AI provider API key saved securely.' };
}

export async function importFigmaFile(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
  url: string,
  logger: Logger,
  onProgress?: ProgressCallback
): Promise<ActionResult<DesignGraph>> {
  if (!validateFigmaUrl(url)) {
    return { ok: false, message: 'This does not look like a figma.com URL.' };
  }
  const fileKey = extractFigmaKey(url);
  if (!fileKey) {
    return { ok: false, message: 'Could not find a file key in this URL.' };
  }

  const config = await loadConfig(context, folder);
  if (!config.figma.accessToken) {
    return { ok: false, message: 'No Figma access token configured. Set one first.' };
  }

  const pipelineInstance = getPipeline(config, logger);
  const unsubscribe = wireProgress(pipelineInstance, onProgress);
  try {
    const designGraph = await pipelineInstance.importFigmaFile(fileKey);
    persistDesignGraph(config, designGraph);
    logger.info(`Imported Figma file ${fileKey}: ${designGraph.pages.length} page(s)`);
    return {
      ok: true,
      message: `Imported "${designGraph.fileName}" — ${designGraph.pages.length} page(s), ${designGraph.components.size} component(s).`,
      data: designGraph,
    };
  } catch (error) {
    logger.error('Figma import failed', describeError(error));
    return { ok: false, message: `Figma import failed: ${describeError(error)}` };
  } finally {
    unsubscribe();
  }
}

export async function analyzeProject(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
  logger: Logger,
  onProgress?: ProgressCallback
): Promise<ActionResult<ProjectGraph>> {
  const config = await loadConfig(context, folder);
  config.flutter.projectPath = folder.uri.fsPath;

  const pipelineInstance = getPipeline(config, logger);
  const unsubscribe = wireProgress(pipelineInstance, onProgress);
  try {
    const projectGraph = await pipelineInstance.analyzeProject();
    persistProjectGraph(config, projectGraph);
    return {
      ok: true,
      message: `Analyzed project — ${projectGraph.widgets.size} widget(s), architecture: ${projectGraph.architecture.pattern}.`,
      data: projectGraph,
    };
  } catch (error) {
    logger.error('Project analysis failed', describeError(error));
    return { ok: false, message: `Project analysis failed: ${describeError(error)}` };
  } finally {
    unsubscribe();
  }
}

export async function generatePlan(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
  logger: Logger,
  onProgress?: ProgressCallback
): Promise<ActionResult<ImplementationPlan>> {
  const config = await loadConfig(context, folder);

  const pipelineInstance = getPipeline(config, logger);
  const unsubscribe = wireProgress(pipelineInstance, onProgress);
  try {
    const plan = await pipelineInstance.generatePlan();
    return {
      ok: true,
      message: `Plan ready — ${plan.summary.widgetsToReuse} to reuse, ${plan.summary.widgetsToUpdate} to update, ${plan.summary.widgetsToCreate} to create.`,
      data: plan,
    };
  } catch (error) {
    return { ok: false, message: `Could not generate plan: ${describeError(error)}` };
  } finally {
    unsubscribe();
  }
}

/** Does not ask for confirmation itself — both the command handler (modal) and the sidebar (inline checkbox) decide that before calling this. */
export async function generateUI(
  context: vscode.ExtensionContext,
  folder: vscode.WorkspaceFolder,
  logger: Logger,
  onProgress?: ProgressCallback
): Promise<ActionResult<{ results: GenerationResult[]; integration: IntegrationResult }>> {
  const config = await loadConfig(context, folder);
  if (!config.ai.apiKey) {
    return { ok: false, message: 'No AI provider API key configured. Set one first.' };
  }

  const pipelineInstance = getPipeline(config, logger);
  const unsubscribe = wireProgress(pipelineInstance, onProgress);
  try {
    const results = await pipelineInstance.generateUI();
    const succeeded = results.filter(r => r.success);
    const integration = await pipelineInstance.integrateFiles(succeeded.map(r => ({ filePath: r.filePath, content: r.content ?? '' })));

    if (results.length !== succeeded.length) {
      logger.warn('Some generation tasks failed', JSON.stringify(results.filter(r => !r.success)));
    }

    return {
      ok: true,
      message: `Generated ${succeeded.length}/${results.length} widget(s). Wrote ${integration.filesCreated} new file(s), updated ${integration.filesModified}.`,
      data: { results, integration },
    };
  } catch (error) {
    return { ok: false, message: `UI generation failed: ${describeError(error)}` };
  } finally {
    unsubscribe();
  }
}

export async function validateCode(context: vscode.ExtensionContext, folder: vscode.WorkspaceFolder, logger: Logger): Promise<ActionResult<ValidationResult>> {
  const config = await loadConfig(context, folder);
  config.flutter.projectPath = folder.uri.fsPath;

  const pipelineInstance = getPipeline(config, logger);
  const result = pipelineInstance.validateCode();

  return {
    ok: result.passed,
    message: result.passed ? 'Validation passed — no issues found.' : `Validation found ${result.errors.length} issue(s). See the Problems panel.`,
    data: result,
  };
}

/** Shared so both the command handler and the sidebar populate the same DiagnosticCollection identically. */
export function populateDiagnostics(diagnostics: vscode.DiagnosticCollection, folder: vscode.WorkspaceFolder, result: ValidationResult): void {
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
}

export async function syncChanges(context: vscode.ExtensionContext, folder: vscode.WorkspaceFolder, logger: Logger): Promise<ActionResult<string[]>> {
  const config = await loadConfig(context, folder);
  config.flutter.projectPath = folder.uri.fsPath;

  try {
    const pipelineInstance = getPipeline(config, logger);
    const relevantTaskIds = await pipelineInstance.syncChanges(
      designGraphPath(config),
      projectGraphPath(config),
      path.join(config.storage.path ?? '.', 'sync-cache')
    );

    return {
      ok: true,
      message: relevantTaskIds.length > 0 ? `Sync found ${relevantTaskIds.length} task(s) that need regenerating.` : 'Sync found no changes since the last run.',
      data: relevantTaskIds,
    };
  } catch (error) {
    return { ok: false, message: `Sync failed: ${describeError(error)}` };
  }
}

export async function getStatus(context: vscode.ExtensionContext, folder: vscode.WorkspaceFolder | undefined, logger: Logger): Promise<StatusSnapshot> {
  const hasFigmaToken = !!(await context.secrets.get(FIGMA_TOKEN_SECRET_KEY));
  const hasAiApiKey = !!(await context.secrets.get(AI_API_KEY_SECRET_KEY));

  if (!folder) {
    return { hasFigmaToken, hasAiApiKey };
  }

  const config = await loadConfig(context, folder);
  const pipelineInstance = getPipeline(config, logger);
  const { designGraph, projectGraph, plan } = pipelineInstance.state;

  return {
    workspaceFolderName: folder.name,
    hasFigmaToken,
    hasAiApiKey,
    designGraph: designGraph ? { fileName: designGraph.fileName, pageCount: designGraph.pages.length, componentCount: designGraph.components.size } : undefined,
    projectGraph: projectGraph ? { widgetCount: projectGraph.widgets.size, architecturePattern: projectGraph.architecture.pattern } : undefined,
    plan: plan ? { widgetsToReuse: plan.summary.widgetsToReuse, widgetsToUpdate: plan.summary.widgetsToUpdate, widgetsToCreate: plan.summary.widgetsToCreate } : undefined,
  };
}
