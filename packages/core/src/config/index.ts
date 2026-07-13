/**
 * Configuration loader for Design Intelligence MCP.
 * Handles loading, validating, and merging configurations.
 */

import { CoreConfig } from '../types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

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

interface PartialStorage {
  type?: 'filesystem' | 'sqlite' | 'memory';
  path?: string;
}

interface PartialLogging {
  level?: 'debug' | 'info' | 'warn' | 'error';
  toConsole?: boolean;
  toFile?: boolean;
  filePath?: string;
}

/**
 * Never store real API keys in `di.config.json` or the checked-in default
 * config — they're resolved from the environment when `ai.apiKey` is left
 * blank, so a project can be configured without any secret touching disk.
 */
function resolveApiKeyFromEnv(provider: 'openai' | 'anthropic' | 'custom'): string {
  switch (provider) {
    case 'anthropic':
      return process.env.ANTHROPIC_API_KEY ?? '';
    case 'openai':
      return process.env.OPENAI_API_KEY ?? '';
    case 'custom':
      return process.env.DI_CUSTOM_API_KEY ?? '';
  }
}

const DEFAULT_CONFIG = {
  projectName: '',
  figma: {
    accessToken: '',
    apiBaseUrl: 'https://api.figma.com/v1',
    cacheEnabled: true,
    cacheTTLMinutes: 60,
  } as PartialFigma,
  flutter: {
    projectPath: '',
    analyzerTimeoutMs: 30000,
    incrementalAnalysis: true,
  } as PartialFlutter,
  ai: {
    provider: 'openai' as const,
    apiKey: '',
    model: 'gpt-4o',
    temperature: 0.2,
    maxTokens: 8192,
  } as PartialAI,
  storage: {
    type: 'filesystem' as const,
    path: path.join(os.homedir(), '.design-intelligence'),
  } as PartialStorage,
  logging: {
    level: 'info' as const,
    toConsole: true,
    toFile: false,
  } as PartialLogging,
};

export class ConfigLoader {
  private config: CoreConfig;
  private configPath?: string;

  constructor(overrides?: Partial<CoreConfig>) {
    this.config = this.buildConfig(overrides);
  }

  loadFromFile(filePath: string): CoreConfig {
    const resolvedPath = path.resolve(filePath);
    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Configuration file not found: ${resolvedPath}`);
    }

    const rawContent = fs.readFileSync(resolvedPath, 'utf-8');
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(rawContent);
    } catch {
      throw new Error(`Failed to parse configuration file (not valid JSON): ${resolvedPath}`);
    }

    this.config = this.buildConfig(parsed as Partial<CoreConfig>);
    this.configPath = resolvedPath;
    return this.getConfig();
  }

  getConfig(): CoreConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  setFigmaConfig(partial: PartialFigma): void {
    this.config.figma = { ...this.config.figma, ...partial };
  }

  setFlutterConfig(partial: PartialFlutter): void {
    this.config.flutter = { ...this.config.flutter, ...partial };
  }

  setAIConfig(partial: PartialAI): void {
    this.config.ai = { ...this.config.ai, ...partial };
  }

  validate(): string[] {
    const errors: string[] = [];

    if (!this.config.figma.accessToken) {
      errors.push('Figma access token is required');
    }

    if (!this.config.flutter.projectPath) {
      errors.push('Flutter project path is required');
    } else if (!fs.existsSync(this.config.flutter.projectPath)) {
      errors.push(`Flutter project path does not exist: ${this.config.flutter.projectPath}`);
    }

    if (!this.config.ai.apiKey) {
      errors.push(
        `${this.config.ai.provider} API key is required (set ai.apiKey, or the ANTHROPIC_API_KEY/OPENAI_API_KEY/DI_CUSTOM_API_KEY environment variable)`
      );
    }

    if (!this.config.projectName?.trim()) {
      errors.push('Project name is required');
    }

    return errors;
  }

  private buildConfig(overrides?: Partial<CoreConfig>): CoreConfig {
    const figma = { ...DEFAULT_CONFIG.figma, ...(overrides?.figma ?? {}) };
    const flutter = { ...DEFAULT_CONFIG.flutter, ...(overrides?.flutter ?? {}) };
    const ai = { ...DEFAULT_CONFIG.ai, ...(overrides?.ai ?? {}) };
    if (!ai.apiKey && ai.provider) {
      ai.apiKey = resolveApiKeyFromEnv(ai.provider);
    }
    const storage = { ...DEFAULT_CONFIG.storage, ...(overrides?.storage ?? {}) };
    const logging = { ...DEFAULT_CONFIG.logging, ...(overrides?.logging ?? {}) };

    return {
      projectName: overrides?.projectName ?? DEFAULT_CONFIG.projectName,
      figma: figma as CoreConfig['figma'],
      flutter: flutter as CoreConfig['flutter'],
      ai: ai as CoreConfig['ai'],
      storage: storage as CoreConfig['storage'],
      logging: logging as CoreConfig['logging'],
    };
  }
}

export function createDefaultConfig(projectName: string): CoreConfig {
  // Goes through ConfigLoader.buildConfig() (rather than a raw JSON
  // round-trip of DEFAULT_CONFIG) so a freshly created config still picks up
  // an API key from the environment instead of always starting blank.
  return new ConfigLoader({
    projectName,
    storage: { type: 'filesystem', path: path.join(os.homedir(), '.design-intelligence', projectName) },
  }).getConfig();
}

export function loadOrCreateConfig(projectPath: string): CoreConfig {
  const configPath = path.join(projectPath, 'di.config.json');

  if (fs.existsSync(configPath)) {
    const loader = new ConfigLoader();
    return loader.loadFromFile(configPath);
  }

  const projectName = path.basename(projectPath);
  return createDefaultConfig(projectName);
}