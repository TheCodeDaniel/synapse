/**
 * Result types for operations in the Design Intelligence MCP core engine.
 * Implements a Result pattern for error handling.
 */

export type Result<T, E = AppError> = Success<T> | Failure<E>;

export interface Success<T> {
  readonly ok: true;
  readonly value: T;
  readonly error?: never;
}

export interface Failure<E> {
  readonly ok: false;
  readonly value?: never;
  readonly error: E;
}

export interface AppError {
  code: ErrorCode;
  message: string;
  details?: unknown;
  stack?: string;
}

export enum ErrorCode {
  // Figma-related errors
  FIGMA_AUTH_FAILED = 'FIGMA_AUTH_FAILED',
  FIGMA_RATE_LIMITED = 'FIGMA_RATE_LIMITED',
  FIGMA_FILE_NOT_FOUND = 'FIGMA_FILE_NOT_FOUND',
  FIGMA_NETWORK_ERROR = 'FIGMA_NETWORK_ERROR',

  // Project analysis errors
  PROJECT_NOT_FOUND = 'PROJECT_NOT_FOUND',
  FLUTTER_NOT_INSTALLED = 'FLUTTER_NOT_INSTALLED',
  ANALYSIS_TIMEOUT = 'ANALYSIS_TIMEOUT',
  PARSING_ERROR = 'PARSING_ERROR',

  // Planning errors
  PLAN_GENERATION_FAILED = 'PLAN_GENERATION_FAILED',
  MATCHING_FAILED = 'MATCHING_FAILED',

  // Generation errors
  GENERATION_FAILED = 'GENERATION_FAILED',
  VALIDATION_FAILED = 'VALIDATION_FAILED',

  // Configuration errors
  INVALID_CONFIG = 'INVALID_CONFIG',
  MISSING_API_KEY = 'MISSING_API_KEY',

  // File system errors
  FILE_NOT_FOUND = 'FILE_NOT_FOUND',
  WRITE_ERROR = 'WRITE_ERROR',
  READ_ERROR = 'READ_ERROR',

  // General errors
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
}

export function ok<T>(value: T): Result<T> {
  return { ok: true, value };
}

export function err<E extends AppError = AppError>(error: E): Result<never, E> {
  return { ok: false, error };
}

export async function okAsync<T>(value: Promise<T>): Promise<Result<Awaited<T>>> {
  try {
    const result = await value;
    return ok(result);
  } catch (error) {
    return err(createError(ErrorCode.UNKNOWN_ERROR, String(error)));
  }
}

export function createError(
  code: ErrorCode,
  message: string,
  details?: unknown
): AppError {
  return { code, message, details };
}

export class DesignIntelligenceError extends Error {
  constructor(
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'DesignIntelligenceError';
  }
}