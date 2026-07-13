/**
 * UI Agent - Generates Flutter UI code based on implementation plans.
 */
import { AIConfig, DesignGraph, ImplementationPlan, ProjectGraph, Task } from '../types';
import { LLMProvider } from './providers';
export interface GenerationResult {
    taskId: string;
    filePath: string;
    success: boolean;
    content?: string;
    error?: string;
}
export declare class UIAgent {
    private config;
    private provider;
    constructor(config: AIConfig, provider?: LLMProvider);
    generate(task: Task, designGraph: DesignGraph, projectGraph: ProjectGraph, plan: ImplementationPlan): Promise<GenerationResult>;
    generateBatch(tasks: Task[], designGraph: DesignGraph, projectGraph: ProjectGraph, plan: ImplementationPlan): Promise<GenerationResult[]>;
    private buildPrompt;
    private getWidgetContext;
    private getThemeContext;
    private getDesignContext;
    /**
     * Returns a node's children, uniformly across the DesignNode union.
     * `ComponentNode` has no `children` field — its content lives under
     * `variants[].children` — so a naive `.children` walk can never find a
     * design node nested inside a component's variants.
     */
    private getChildNodes;
    private callModel;
}
//# sourceMappingURL=index.d.ts.map