/**
 * Pipeline - Orchestrates the full Figma-to-Flutter flow (import, analyze,
 * plan, generate, validate, integrate, sync) so callers like the VS Code
 * extension don't have to hand-wire 9 separate classes together.
 *
 * This is also the first real consumer of `CoreEvent`/`EventCallback`
 * (previously fully-defined, fully-unused types with no emitter anywhere in
 * the codebase) — every step reports progress here, which is what lets the
 * extension show a real progress bar instead of a fake `setTimeout`.
 */

import {
  CoreConfig,
  CoreEvent,
  EventCallback,
  DesignGraph,
  DesignNode,
  ProjectGraph,
  ImplementationPlan,
} from '../types';
import { Cache, Logger, createLogger, getChildNodes } from '../utils';
import { FigmaClient, DesignCompiler } from '../compiler';
import { ComponentDiscoveryEngine } from '../discovery';
import { FlutterAnalyzer } from '../analyzer';
import { PlanningEngine } from '../planning';
import { UIAgent, GenerationResult } from '../agent';
import { LLMProvider } from '../agent/providers';
import { CodeValidator, ValidationResult } from '../validation';
import { ProjectIntegrator, IntegrationResult } from '../integration';
import { IncrementalSync } from '../sync';

export interface PipelineState {
  designGraph?: DesignGraph;
  projectGraph?: ProjectGraph;
  plan?: ImplementationPlan;
}

export interface PipelineOptions {
  logger?: Logger;
  /** Overrides the LLM provider UIAgent would otherwise construct from config.ai — mainly for tests/custom setups. */
  llmProvider?: LLMProvider;
}

export class Pipeline {
  readonly state: PipelineState = {};

  private config: CoreConfig;
  private logger: Logger;
  private llmProvider?: LLMProvider;
  private listeners = new Set<EventCallback>();

  constructor(config: CoreConfig, options: PipelineOptions = {}) {
    this.config = config;
    this.logger = options.logger ?? createLogger(config.logging, 'DI-Pipeline');
    this.llmProvider = options.llmProvider;
  }

  /** Subscribes to pipeline events (progress, per-step completion). Returns an unsubscribe function. */
  on(callback: EventCallback): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  async importFigmaFile(fileKey: string): Promise<DesignGraph> {
    this.emitProgress('Fetching Figma file...', 0, 1);

    const cache = this.config.figma.cacheEnabled ? new Cache(this.config.figma.cacheTTLMinutes) : null;
    const client = new FigmaClient(this.config.figma.accessToken, cache, this.logger);
    const compiler = new DesignCompiler(client);
    const designGraph = await compiler.compile(fileKey);
    designGraph.discoveredPatterns = new ComponentDiscoveryEngine().discover(designGraph);

    this.state.designGraph = designGraph;
    this.emitProgress('Figma file imported', 1, 1);
    this.emit({
      type: 'design.compiled',
      timestamp: new Date().toISOString(),
      projectId: this.config.projectName,
      designGraphId: designGraph.id,
      nodeCount: this.countDesignNodes(designGraph),
      componentCount: designGraph.components.size,
      pageNames: designGraph.pages.map(p => p.name),
    });

    return designGraph;
  }

  async analyzeProject(): Promise<ProjectGraph> {
    this.emitProgress('Analyzing Flutter project...', 0, 1);

    const analyzer = new FlutterAnalyzer(this.config.flutter.projectPath);
    const projectGraph = await analyzer.analyze();

    this.state.projectGraph = projectGraph;
    this.emitProgress('Flutter project analyzed', 1, 1);
    this.emit({
      type: 'project.analyzed',
      timestamp: new Date().toISOString(),
      projectId: this.config.projectName,
      projectGraphId: projectGraph.id,
      widgetCount: projectGraph.widgets.size,
      routeCount: projectGraph.routing.routeDefinitions.length,
      themeColorCount: projectGraph.themes.colors.size,
    });

    return projectGraph;
  }

  async generatePlan(): Promise<ImplementationPlan> {
    if (!this.state.designGraph) throw new Error('Import a Figma file before generating a plan.');
    if (!this.state.projectGraph) throw new Error('Analyze the Flutter project before generating a plan.');

    this.emitProgress('Generating implementation plan...', 0, 1);
    const plan = await new PlanningEngine().compare(this.state.designGraph, this.state.projectGraph);

    this.state.plan = plan;
    this.emitProgress('Implementation plan generated', 1, 1);
    this.emit({
      type: 'plan.generated',
      timestamp: new Date().toISOString(),
      projectId: this.config.projectName,
      planId: plan.id,
      taskCount: plan.tasks.length,
      estimatedTimeMs: 0,
    });

    return plan;
  }

  async generateUI(): Promise<GenerationResult[]> {
    if (!this.state.plan || !this.state.designGraph || !this.state.projectGraph) {
      throw new Error('Generate an implementation plan before generating UI code.');
    }

    const agent = new UIAgent(this.config.ai, this.llmProvider);
    const { tasks } = this.state.plan;
    const results: GenerationResult[] = [];

    for (let i = 0; i < tasks.length; i++) {
      this.emitProgress(`Generating ${tasks[i].title}...`, i, tasks.length);
      const result = await agent.generate(tasks[i], this.state.designGraph, this.state.projectGraph, this.state.plan);
      results.push(result);
      this.emit({
        type: 'widget.generated',
        timestamp: new Date().toISOString(),
        projectId: this.config.projectName,
        widgetName: tasks[i].title,
        filePath: result.filePath,
        success: result.success,
      });
    }

    this.emitProgress('UI generation complete', tasks.length, tasks.length);
    return results;
  }

  validateCode(): ValidationResult {
    const result = new CodeValidator(this.config.flutter.projectPath).validate();

    this.emit({
      type: 'validation.completed',
      timestamp: new Date().toISOString(),
      projectId: this.config.projectName,
      passed: result.passed,
      errors: result.errors,
      warnings: result.warnings,
    });

    return result;
  }

  async integrateFiles(files: Array<{ filePath: string; content: string }>): Promise<IntegrationResult> {
    const result = await new ProjectIntegrator(this.config.flutter.projectPath).integrateGeneratedFiles(files);

    this.emit({
      type: 'integration.completed',
      timestamp: new Date().toISOString(),
      projectId: this.config.projectName,
      filesModified: result.filesModified,
      filesCreated: result.filesCreated,
      routesUpdated: result.routesUpdated,
    });

    return result;
  }

  /** Returns the ids of previously-generated tasks that are still relevant given what's changed since the last sync. */
  async syncChanges(designGraphPath: string, projectGraphPath: string, cacheDir: string): Promise<string[]> {
    const sync = new IncrementalSync(this.config.flutter.projectPath, cacheDir);
    const changes = sync.detectChanges(designGraphPath, projectGraphPath);
    return sync.getRelevantTasks(changes, this.state.plan?.tasks ?? []);
  }

  private countDesignNodes(graph: DesignGraph): number {
    let count = 0;
    const visit = (nodes: DesignNode[]): void => {
      for (const node of nodes) {
        count++;
        visit(getChildNodes(node));
      }
    };
    for (const page of graph.pages) visit(page.children);
    return count;
  }

  private emitProgress(message: string, current: number, total: number): void {
    this.emit({
      type: 'progress',
      timestamp: new Date().toISOString(),
      projectId: this.config.projectName,
      message,
      current,
      total,
      percentage: total > 0 ? Math.round((current / total) * 100) : 0,
    });
  }

  private emit(event: CoreEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}
