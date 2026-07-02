"use strict";
/**
 * Result types for operations in the Design Intelligence MCP core engine.
 * Implements a Result pattern for error handling.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.DesignIntelligenceError = exports.ErrorCode = void 0;
exports.ok = ok;
exports.err = err;
exports.okAsync = okAsync;
exports.createError = createError;
var ErrorCode;
(function (ErrorCode) {
    // Figma-related errors
    ErrorCode["FIGMA_AUTH_FAILED"] = "FIGMA_AUTH_FAILED";
    ErrorCode["FIGMA_RATE_LIMITED"] = "FIGMA_RATE_LIMITED";
    ErrorCode["FIGMA_FILE_NOT_FOUND"] = "FIGMA_FILE_NOT_FOUND";
    ErrorCode["FIGMA_NETWORK_ERROR"] = "FIGMA_NETWORK_ERROR";
    // Project analysis errors
    ErrorCode["PROJECT_NOT_FOUND"] = "PROJECT_NOT_FOUND";
    ErrorCode["FLUTTER_NOT_INSTALLED"] = "FLUTTER_NOT_INSTALLED";
    ErrorCode["ANALYSIS_TIMEOUT"] = "ANALYSIS_TIMEOUT";
    ErrorCode["PARSING_ERROR"] = "PARSING_ERROR";
    // Planning errors
    ErrorCode["PLAN_GENERATION_FAILED"] = "PLAN_GENERATION_FAILED";
    ErrorCode["MATCHING_FAILED"] = "MATCHING_FAILED";
    // Generation errors
    ErrorCode["GENERATION_FAILED"] = "GENERATION_FAILED";
    ErrorCode["VALIDATION_FAILED"] = "VALIDATION_FAILED";
    // Configuration errors
    ErrorCode["INVALID_CONFIG"] = "INVALID_CONFIG";
    ErrorCode["MISSING_API_KEY"] = "MISSING_API_KEY";
    // File system errors
    ErrorCode["FILE_NOT_FOUND"] = "FILE_NOT_FOUND";
    ErrorCode["WRITE_ERROR"] = "WRITE_ERROR";
    ErrorCode["READ_ERROR"] = "READ_ERROR";
    // General errors
    ErrorCode["UNKNOWN_ERROR"] = "UNKNOWN_ERROR";
    ErrorCode["INTERNAL_ERROR"] = "INTERNAL_ERROR";
})(ErrorCode || (exports.ErrorCode = ErrorCode = {}));
function ok(value) {
    return { ok: true, value };
}
function err(error) {
    return { ok: false, error };
}
async function okAsync(value) {
    try {
        const result = await value;
        return ok(result);
    }
    catch (error) {
        return err(createError(ErrorCode.UNKNOWN_ERROR, String(error)));
    }
}
function createError(code, message, details) {
    return { code, message, details };
}
class DesignIntelligenceError extends Error {
    code;
    details;
    constructor(code, message, details) {
        super(message);
        this.code = code;
        this.details = details;
        this.name = 'DesignIntelligenceError';
    }
}
exports.DesignIntelligenceError = DesignIntelligenceError;
//# sourceMappingURL=results.js.map