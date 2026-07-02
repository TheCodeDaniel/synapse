/**
 * Configuration loader for Design Intelligence MCP.
 * Handles loading, validating, and merging configurations.
 */
import { CoreConfig } from '../types';
interface PartialFigma {
    accessToken?: string;
    apiBaseUrl?: string;
    cacheEnabled?: boolean;
    cacheTTLMinutes?: number;
}
interface PartialFlutter {
    projectPath?: string;
    analyzerTimeoutMs?: number;
    incrementalAnalysis?: boolean;
}
interface PartialAI {
    provider?: 'openai' | 'anthropic' | 'custom';
    apiKey?: string;
    model?: string;
    temperature?: number;
    maxTokens?: number;
    baseUrl?: string;
}
export declare class ConfigLoader {
    private config;
    private configPath?;
    constructor(overrides?: Partial<CoreConfig>);
    loadFromFile(filePath: string): CoreConfig;
    getConfig(): CoreConfig;
    setFigmaConfig(partial: PartialFigma): void;
    setFlutterConfig(partial: PartialFlutter): void;
    setAIConfig(partial: PartialAI): void;
    validate(): string[];
    private buildConfig;
}
export declare function createDefaultConfig(projectName: string): CoreConfig;
export declare function loadOrCreateConfig(projectPath: string): CoreConfig;
export {};
//# sourceMappingURL=index.d.ts.map