/**
 * Configuration types for the Design Intelligence MCP core engine.
 */

export interface CoreConfig {
  projectName: string;
  figma: FigmaConfig;
  flutter: FlutterConfig;
  ai: AIConfig;
  storage: StorageConfig;
  logging: LoggingConfig;
}

export interface FigmaConfig {
  accessToken: string;
  apiBaseUrl: string;
  cacheEnabled: boolean;
  cacheTTLMinutes: number;
}

export interface FlutterConfig {
  projectPath: string;
  analyzerTimeoutMs: number;
  incrementalAnalysis: boolean;
}

export interface AIConfig {
  provider: 'openai' | 'anthropic' | 'custom';
  apiKey: string;
  model: string;
  temperature: number;
  maxTokens: number;
  baseUrl?: string;
}

export interface StorageConfig {
  type: 'filesystem' | 'sqlite' | 'memory';
  path?: string;
}

export interface LoggingConfig {
  level: 'debug' | 'info' | 'warn' | 'error';
  toConsole: boolean;
  toFile: boolean;
  filePath?: string;
}