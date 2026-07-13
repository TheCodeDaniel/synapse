/**
 * UI Agent - Generates Flutter UI code based on implementation plans.
 */

import { AIConfig, DesignGraph, DesignNode, ImplementationPlan, ProjectGraph, Task } from '../types';
import { createProvider, LLMProvider } from './providers';

export interface GenerationResult {
  taskId: string;
  filePath: string;
  success: boolean;
  content?: string;
  error?: string;
}

export class UIAgent {
  private config: AIConfig;
  private provider: LLMProvider;

  constructor(config: AIConfig, provider?: LLMProvider) {
    this.config = config;
    this.provider = provider ?? createProvider(config);
  }

  async generate(
    task: Task,
    designGraph: DesignGraph,
    projectGraph: ProjectGraph,
    plan: ImplementationPlan
  ): Promise<GenerationResult> {
    try {
      const prompt = this.buildPrompt(task, designGraph, projectGraph);
      const response = await this.callModel(prompt);

      return {
        taskId: task.id,
        filePath: task.targetFilePath || `lib/generated/${task.title.toLowerCase().replace(/\s+/g, '_')}.dart`,
        success: true,
        content: response,
      };
    } catch (error) {
      return {
        taskId: task.id,
        filePath: '',
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  async generateBatch(
    tasks: Task[],
    designGraph: DesignGraph,
    projectGraph: ProjectGraph,
    plan: ImplementationPlan
  ): Promise<GenerationResult[]> {
    const results: GenerationResult[] = [];

    for (const task of tasks) {
      const result = await this.generate(task, designGraph, projectGraph, plan);
      results.push(result);
    }

    return results;
  }

  private buildPrompt(
    task: Task,
    designGraph: DesignGraph,
    projectGraph: ProjectGraph
  ): string {
    const widgetContext = this.getWidgetContext(task, projectGraph);
    const themeContext = this.getThemeContext(projectGraph);
    const designContext = this.getDesignContext(task, designGraph);

    return [
      `You are a senior Flutter developer. Generate production-quality Flutter UI code following the exact requirements below.`,
      '',
      `## Task: ${task.title}`,
      '',
      `${task.description}`,
      '',
      widgetContext ? `## Existing Widget Context\n${widgetContext}` : '',
      themeContext,
      designContext,
      '',
      `## Requirements`,
      `- Follow the project's naming conventions and code style`,
      '- Use const constructors where possible',
      '- Respect existing design tokens and theming',
      '- Ensure responsive layout support',
      '- Include proper accessibility labels',
      '- No state management or API calls in v1',
      '',
      `## Output Format`,
      `Generate only the Dart code for this widget/page. Do not include explanations, markdown formatting, or any other text outside of the code block.`,
    ].join('\n');
  }

  private getWidgetContext(task: Task, projectGraph: ProjectGraph): string {
    if (!task.existingWidgetId) return '';

    const widget = projectGraph.widgets.get(task.existingWidgetId);
    if (!widget) return '';

    return `Existing widget at ${widget.relativePath}:\n- Type: ${widget.type}\n- Parameters: ${widget.parameters.map(p => `${p.name}: ${p.type}`).join(', ') || 'none'}`;
  }

  private getThemeContext(projectGraph: ProjectGraph): string {
    const colors = projectGraph.themes.colors;
    const textStyles = projectGraph.themes.textStyles;

    return [
      `## Theme Context`,
      `- Available colors: ${colors.size > 0 ? 'Yes' : 'No (use Material defaults)'}`,
      `- Text styles available: ${textStyles.size}`,
    ].join('\n');
  }

  private getDesignContext(task: Task, designGraph: DesignGraph): string {
    if (!task.designNodeId) return '';

    const searchNodes = (nodes: DesignNode[]): DesignNode | null => {
      for (const node of nodes) {
        if (node?.id === task.designNodeId) return node;
        const found = searchNodes(this.getChildNodes(node));
        if (found) return found;
      }
      return null;
    };

    for (const page of designGraph.pages) {
      const node = searchNodes(page.children);
      if (node) {
        const layoutMode = 'layoutMode' in node ? node.layoutMode : 'none';
        return `## Design Context\nFound in page: ${page.name}\nNode type: ${node.type}\nLayout mode: ${layoutMode}`;
      }
    }

    return '';
  }

  /**
   * Returns a node's children, uniformly across the DesignNode union.
   * `ComponentNode` has no `children` field — its content lives under
   * `variants[].children` — so a naive `.children` walk can never find a
   * design node nested inside a component's variants.
   */
  private getChildNodes(node: DesignNode): DesignNode[] {
    switch (node.type) {
      case 'frame':
      case 'group':
      case 'instance':
      case 'variant':
      case 'document':
      case 'slice':
        return node.children;
      case 'component':
        return node.variants.flatMap(variant => variant.children);
      default:
        return [];
    }
  }

  private async callModel(prompt: string): Promise<string> {
    const result = await this.provider.complete(prompt, {
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens,
    });

    if (!result.ok) {
      throw new Error(result.error.message);
    }

    return result.value;
  }
}
