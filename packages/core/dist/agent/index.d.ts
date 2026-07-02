/**
 * UI Agent - Generates Flutter UI code based on implementation plans.
 */
import { ImplementationPlan, Task, DesignGraph, ProjectGraph } from '../types';
export interface GenerationResult {
    taskId: string;
    filePath: string;
    success: boolean;
    content?: string;
    error?: string;
}
interface AgentConfig {
    provider: 'openai' | 'anthropic' | 'custom';
    model: string;
    apiKey: string;
    temperature: number;
    maxTokens: number;
    baseUrl?: string;
}
export declare class UIAgent {
    private config;
    constructor(config: AgentConfig);
    generate(task: Task, designGraph: DesignGraph, projectGraph: ProjectGraph, plan: ImplementationPlan): Promise<GenerationResult>;
    generateBatch(tasks: Task[], designGraph: DesignGraph, projectGraph: ProjectGraph, plan: ImplementationPlan): Promise<GenerationResult[]>;
    private buildPrompt;
    private getWidgetContext;
    private getThemeContext;
    private getDesignContext;
    private callModel;
}
export {};
//# sourceMappingURL=index.d.ts.map