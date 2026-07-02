"use strict";
/**
 * UI Agent - Generates Flutter UI code based on implementation plans.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.UIAgent = void 0;
class UIAgent {
    config;
    constructor(config) {
        this.config = config;
    }
    async generate(task, designGraph, projectGraph, plan) {
        try {
            const prompt = this.buildPrompt(task, designGraph, projectGraph);
            const response = await this.callModel(prompt);
            return {
                taskId: task.id,
                filePath: task.targetFilePath || `lib/generated/${task.title.toLowerCase().replace(/\s+/g, '_')}.dart`,
                success: true,
                content: response,
            };
        }
        catch (error) {
            return {
                taskId: task.id,
                filePath: '',
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }
    async generateBatch(tasks, designGraph, projectGraph, plan) {
        const results = [];
        for (const task of tasks) {
            const result = await this.generate(task, designGraph, projectGraph, plan);
            results.push(result);
        }
        return results;
    }
    buildPrompt(task, designGraph, projectGraph) {
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
    getWidgetContext(task, projectGraph) {
        if (!task.existingWidgetId)
            return '';
        const widget = projectGraph.widgets.get(task.existingWidgetId);
        if (!widget)
            return '';
        return `Existing widget at ${widget.relativePath}:\n- Type: ${widget.type}\n- Parameters: ${widget.parameters.map(p => `${p.name}: ${p.type}`).join(', ') || 'none'}`;
    }
    getThemeContext(projectGraph) {
        const colors = projectGraph.themes.colors;
        const textStyles = projectGraph.themes.textStyles;
        return [
            `## Theme Context`,
            `- Available colors: ${colors.size > 0 ? 'Yes' : 'No (use Material defaults)'}`,
            `- Text styles available: ${textStyles.size}`,
        ].join('\n');
    }
    getDesignContext(task, designGraph) {
        if (!task.designNodeId)
            return '';
        const searchNodes = (nodes, depth = 0) => {
            for (const node of nodes) {
                if (node?.id === task.designNodeId)
                    return node;
                if (node?.children) {
                    const found = searchNodes(node.children, depth + 1);
                    if (found)
                        return found;
                }
            }
            return null;
        };
        for (const page of designGraph.pages) {
            const node = searchNodes([page]);
            if (node) {
                return `## Design Context\nFound in page: ${page.name}\nNode type: ${node.type}\nLayout mode: ${node.layoutMode || 'none'}`;
            }
        }
        return '';
    }
    async callModel(prompt) {
        // Placeholder for actual LLM API integration
        // In production, this would call the configured AI provider
        const baseUrl = this.config.baseUrl ?? getDefaultBaseUrl(this.config.provider);
        // This is a stub - real implementation would use axios/fetch
        throw new Error('LLM integration not implemented in prototype');
    }
}
exports.UIAgent = UIAgent;
function getDefaultBaseUrl(provider) {
    switch (provider) {
        case 'openai': return 'https://api.openai.com/v1';
        case 'anthropic': return 'https://api.anthropic.com';
        default: throw new Error(`Unknown provider: ${provider}`);
    }
}
//# sourceMappingURL=index.js.map