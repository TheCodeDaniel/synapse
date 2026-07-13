/**
 * @design-intelligence/core - Main export file
 *
 * Design Intelligence MCP Core Engine
 * A local-first developer tool that understands both Figma designs and Flutter codebases.
 */

// Types
export * from "./types";

// Config
export {
  ConfigLoader,
  createDefaultConfig,
  loadOrCreateConfig,
} from "./config";
export type {
  CoreConfig,
  FigmaConfig,
  FlutterConfig,
  AIConfig,
  StorageConfig,
  LoggingConfig,
} from "./types";

// Utils
export { Logger, LogLevel, createLogger, Cache } from "./utils";
export {
  serializeDesignGraph,
  deserializeDesignGraph,
  serializeProjectGraph,
  deserializeProjectGraph,
} from "./utils";

// OAuth
export { FigmaOAuthManager, extractFigmaKey, validateFigmaUrl } from "./oauth";
export type { FigmaTokens, FigmaOAuthConfig } from "./oauth";

// Compiler (Figma)
export { FigmaClient, DesignCompiler } from "./compiler";
export type {
  FigmaFileResponse,
  FigmaComponentResponse,
  FigmaVariableResponse,
  FigmaVariableCollectionResponse,
  DocumentNode,
  FigmaPageNode,
  FigmaFrameNode,
  FigmaColor,
  FigmaPaint,
  FigmaGradientStop,
  FigmaEffect,
  FigmaGridStyle,
  FigmaTextStyle,
  FigmaComponentMetadata,
  FigmaStyleMetadata,
} from "./compiler";

// Analyzer (Flutter)
export { FlutterAnalyzer } from "./analyzer";

// Planning Engine
export { PlanningEngine } from "./planning";
export type { ImplementationPlan, Task, WidgetMatch } from "./types";

// UI Agent
export { UIAgent } from "./agent";
export type { GenerationResult } from "./agent";
export {
  AnthropicProvider,
  OpenAIProvider,
  CustomProvider,
  createProvider,
} from "./agent/providers";
export type { LLMProvider, LLMCompletionOptions } from "./agent/providers";

// Validation
export { CodeValidator } from "./validation";
export type { ValidationResult } from "./validation";

// Integration
export { ProjectIntegrator } from "./integration";
export type { IntegrationResult } from "./integration";

// Sync
export { IncrementalSync } from "./sync";
export type { ChangeSet, SyncOptions } from "./sync";

// Events & Results
export type {
  EventType,
  BaseEvent,
  CoreEvent,
  EventCallback,
  ValidationError,
} from "./types";
export type { Result, Success, Failure, AppError } from "./types";
export { ErrorCode, ok, err, okAsync, createError, DesignIntelligenceError } from "./types";
