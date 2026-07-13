/**
 * Central type exports for @design-intelligence/core
 */

export type { CoreConfig, FigmaConfig, FlutterConfig, AIConfig, StorageConfig, LoggingConfig } from './config';
export type { BaseEvent, EventType, CoreEvent, EventCallback, ValidationError } from './events';
export type { Result, Success, Failure, AppError } from './results';
export { ErrorCode, ok, err, okAsync, createError, DesignIntelligenceError } from './results';
export * from './design.graph';
export * from './project.graph';
export * from './planning.engine';
