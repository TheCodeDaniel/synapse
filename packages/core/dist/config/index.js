"use strict";
/**
 * Configuration loader for Design Intelligence MCP.
 * Handles loading, validating, and merging configurations.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConfigLoader = void 0;
exports.createDefaultConfig = createDefaultConfig;
exports.loadOrCreateConfig = loadOrCreateConfig;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const os = __importStar(require("os"));
/**
 * Never store real API keys in `di.config.json` or the checked-in default
 * config — they're resolved from the environment when `ai.apiKey` is left
 * blank, so a project can be configured without any secret touching disk.
 */
function resolveApiKeyFromEnv(provider) {
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
    },
    flutter: {
        projectPath: '',
        analyzerTimeoutMs: 30000,
        incrementalAnalysis: true,
    },
    ai: {
        provider: 'openai',
        apiKey: '',
        model: 'gpt-4o',
        temperature: 0.2,
        maxTokens: 8192,
    },
    storage: {
        type: 'filesystem',
        path: path.join(os.homedir(), '.design-intelligence'),
    },
    logging: {
        level: 'info',
        toConsole: true,
        toFile: false,
    },
};
class ConfigLoader {
    config;
    configPath;
    constructor(overrides) {
        this.config = this.buildConfig(overrides);
    }
    loadFromFile(filePath) {
        const resolvedPath = path.resolve(filePath);
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Configuration file not found: ${resolvedPath}`);
        }
        const rawContent = fs.readFileSync(resolvedPath, 'utf-8');
        let parsed;
        try {
            parsed = JSON.parse(rawContent);
        }
        catch {
            throw new Error(`Failed to parse configuration file (not valid JSON): ${resolvedPath}`);
        }
        this.config = this.buildConfig(parsed);
        this.configPath = resolvedPath;
        return this.getConfig();
    }
    getConfig() {
        return JSON.parse(JSON.stringify(this.config));
    }
    setFigmaConfig(partial) {
        this.config.figma = { ...this.config.figma, ...partial };
    }
    setFlutterConfig(partial) {
        this.config.flutter = { ...this.config.flutter, ...partial };
    }
    setAIConfig(partial) {
        this.config.ai = { ...this.config.ai, ...partial };
    }
    validate() {
        const errors = [];
        if (!this.config.figma.accessToken) {
            errors.push('Figma access token is required');
        }
        if (!this.config.flutter.projectPath) {
            errors.push('Flutter project path is required');
        }
        else if (!fs.existsSync(this.config.flutter.projectPath)) {
            errors.push(`Flutter project path does not exist: ${this.config.flutter.projectPath}`);
        }
        if (!this.config.ai.apiKey) {
            errors.push(`${this.config.ai.provider} API key is required (set ai.apiKey, or the ANTHROPIC_API_KEY/OPENAI_API_KEY/DI_CUSTOM_API_KEY environment variable)`);
        }
        if (!this.config.projectName?.trim()) {
            errors.push('Project name is required');
        }
        return errors;
    }
    buildConfig(overrides) {
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
            figma: figma,
            flutter: flutter,
            ai: ai,
            storage: storage,
            logging: logging,
        };
    }
}
exports.ConfigLoader = ConfigLoader;
function createDefaultConfig(projectName) {
    // Goes through ConfigLoader.buildConfig() (rather than a raw JSON
    // round-trip of DEFAULT_CONFIG) so a freshly created config still picks up
    // an API key from the environment instead of always starting blank.
    return new ConfigLoader({
        projectName,
        storage: { type: 'filesystem', path: path.join(os.homedir(), '.design-intelligence', projectName) },
    }).getConfig();
}
function loadOrCreateConfig(projectPath) {
    const configPath = path.join(projectPath, 'di.config.json');
    if (fs.existsSync(configPath)) {
        const loader = new ConfigLoader();
        return loader.loadFromFile(configPath);
    }
    const projectName = path.basename(projectPath);
    return createDefaultConfig(projectName);
}
//# sourceMappingURL=index.js.map