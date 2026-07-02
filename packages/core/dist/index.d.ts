/**
 * @design-intelligence/core - Main export file
 *
 * Design Intelligence MCP Core Engine
 * A local-first developer tool that understands both Figma designs and Flutter codebases.
 */
export * from './types';
export { ConfigLoader, createDefaultConfig, loadOrCreateConfig } from './config';
export type { CoreConfig, FigmaConfig, FlutterConfig, AIConfig, StorageConfig, LoggingConfig } from './types';
export { Logger, LogLevel, createLogger, Cache } from './utils';
export { FigmaOAuthManager, extractFigmaKey, validateFigmaUrl } from './oauth';
export type { FigmaTokens, FigmaOAuthConfig } from './oauth';
export { FigmaClient, DesignCompiler } from './compiler';
export type { FigmaFileResponse, FigmaComponentResponse, FigmaVariableResponse, FigmaVariableCollectionResponse, DocumentNode, FigmaPageNode, FigmaFrameNode, FigmaStyle, FigmaPaint, FigmaEffect, FigmaGridStyle } from './compiler';
export { FlutterAnalyzer } from './analyzer';
export { PlanningEngine } from './planning';
export type { ImplementationPlan, Task, WidgetMatch } from './types';
export { UIAgent } from './agent';
export type { GenerationResult } from './agent';
export { CodeValidator } from './validation';
export type { ValidationResult } from './validation';
export { ProjectIntegrator } from './integration';
export type { IntegrationResult } from './integration';
export { IncrementalSync } from './sync';
export type { ChangeSet, SyncOptions } from './sync';
export type { EventType, BaseEvent, CoreEvent, EventCallback, ValidationError } from './types';
export type { Result, Success, Failure, AppError, ErrorCode } from './types';
//# sourceMappingURL=index.d.ts.map