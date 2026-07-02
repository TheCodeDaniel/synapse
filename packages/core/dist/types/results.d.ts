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
export declare enum ErrorCode {
    FIGMA_AUTH_FAILED = "FIGMA_AUTH_FAILED",
    FIGMA_RATE_LIMITED = "FIGMA_RATE_LIMITED",
    FIGMA_FILE_NOT_FOUND = "FIGMA_FILE_NOT_FOUND",
    FIGMA_NETWORK_ERROR = "FIGMA_NETWORK_ERROR",
    PROJECT_NOT_FOUND = "PROJECT_NOT_FOUND",
    FLUTTER_NOT_INSTALLED = "FLUTTER_NOT_INSTALLED",
    ANALYSIS_TIMEOUT = "ANALYSIS_TIMEOUT",
    PARSING_ERROR = "PARSING_ERROR",
    PLAN_GENERATION_FAILED = "PLAN_GENERATION_FAILED",
    MATCHING_FAILED = "MATCHING_FAILED",
    GENERATION_FAILED = "GENERATION_FAILED",
    VALIDATION_FAILED = "VALIDATION_FAILED",
    INVALID_CONFIG = "INVALID_CONFIG",
    MISSING_API_KEY = "MISSING_API_KEY",
    FILE_NOT_FOUND = "FILE_NOT_FOUND",
    WRITE_ERROR = "WRITE_ERROR",
    READ_ERROR = "READ_ERROR",
    UNKNOWN_ERROR = "UNKNOWN_ERROR",
    INTERNAL_ERROR = "INTERNAL_ERROR"
}
export declare function ok<T>(value: T): Result<T>;
export declare function err<E extends AppError = AppError>(error: E): Result<never, E>;
export declare function okAsync<T>(value: Promise<T>): Promise<Result<Awaited<T>>>;
export declare function createError(code: ErrorCode, message: string, details?: unknown): AppError;
export declare class DesignIntelligenceError extends Error {
    readonly code: ErrorCode;
    readonly details?: unknown | undefined;
    constructor(code: ErrorCode, message: string, details?: unknown | undefined);
}
//# sourceMappingURL=results.d.ts.map