/**
 * @design-intelligence/core - Main export file
 *
 * Design Intelligence MCP Core Engine
 * A local-first developer tool that understands both Figma designs and Flutter codebases.
 */
export * from "./types";
export { ConfigLoader, createDefaultConfig, loadOrCreateConfig, } from "./config";
export type { CoreConfig, FigmaConfig, FlutterConfig, AIConfig, StorageConfig, LoggingConfig, } from "./types";
export { Logger, LogLevel, createLogger, Cache } from "./utils";
export { serializeDesignGraph, deserializeDesignGraph, serializeProjectGraph, deserializeProjectGraph, } from "./utils";
export { FigmaOAuthManager, extractFigmaKey, validateFigmaUrl } from "./oauth";
export type { FigmaTokens, FigmaOAuthConfig } from "./oauth";
export { FigmaClient, DesignCompiler } from "./compiler";
export type { FigmaFileResponse, FigmaComponentResponse, FigmaVariableResponse, FigmaVariableCollectionResponse, DocumentNode, FigmaPageNode, FigmaFrameNode, FigmaColor, FigmaPaint, FigmaGradientStop, FigmaEffect, FigmaGridStyle, FigmaTextStyle, FigmaComponentMetadata, FigmaStyleMetadata, } from "./compiler";
export { FlutterAnalyzer } from "./analyzer";
export { PlanningEngine } from "./planning";
export type { ImplementationPlan, Task, WidgetMatch } from "./types";
export { UIAgent } from "./agent";
export type { GenerationResult } from "./agent";
export { AnthropicProvider, OpenAIProvider, CustomProvider, createProvider, } from "./agent/providers";
export type { LLMProvider, LLMCompletionOptions } from "./agent/providers";
export { CodeValidator } from "./validation";
export type { ValidationResult } from "./validation";
export { ProjectIntegrator } from "./integration";
export type { IntegrationResult } from "./integration";
export { IncrementalSync } from "./sync";
export type { ChangeSet, SyncOptions } from "./sync";
export type { EventType, BaseEvent, CoreEvent, EventCallback, ValidationError, } from "./types";
export type { Result, Success, Failure, AppError } from "./types";
export { ErrorCode, ok, err, okAsync, createError, DesignIntelligenceError } from "./types";
//# sourceMappingURL=index.d.ts.map