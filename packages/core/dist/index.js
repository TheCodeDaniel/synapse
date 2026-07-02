"use strict";
/**
 * @design-intelligence/core - Main export file
 *
 * Design Intelligence MCP Core Engine
 * A local-first developer tool that understands both Figma designs and Flutter codebases.
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
var __exportStar = (this && this.__exportStar) || function(m, exports) {
    for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(exports, p)) __createBinding(exports, m, p);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncrementalSync = exports.ProjectIntegrator = exports.CodeValidator = exports.UIAgent = exports.PlanningEngine = exports.FlutterAnalyzer = exports.DesignCompiler = exports.FigmaClient = exports.validateFigmaUrl = exports.extractFigmaKey = exports.FigmaOAuthManager = exports.Cache = exports.createLogger = exports.LogLevel = exports.Logger = exports.loadOrCreateConfig = exports.createDefaultConfig = exports.ConfigLoader = void 0;
// Types
__exportStar(require("./types"), exports);
// Config
var config_1 = require("./config");
Object.defineProperty(exports, "ConfigLoader", { enumerable: true, get: function () { return config_1.ConfigLoader; } });
Object.defineProperty(exports, "createDefaultConfig", { enumerable: true, get: function () { return config_1.createDefaultConfig; } });
Object.defineProperty(exports, "loadOrCreateConfig", { enumerable: true, get: function () { return config_1.loadOrCreateConfig; } });
// Utils
var utils_1 = require("./utils");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return utils_1.Logger; } });
Object.defineProperty(exports, "LogLevel", { enumerable: true, get: function () { return utils_1.LogLevel; } });
Object.defineProperty(exports, "createLogger", { enumerable: true, get: function () { return utils_1.createLogger; } });
Object.defineProperty(exports, "Cache", { enumerable: true, get: function () { return utils_1.Cache; } });
// OAuth
var oauth_1 = require("./oauth");
Object.defineProperty(exports, "FigmaOAuthManager", { enumerable: true, get: function () { return oauth_1.FigmaOAuthManager; } });
Object.defineProperty(exports, "extractFigmaKey", { enumerable: true, get: function () { return oauth_1.extractFigmaKey; } });
Object.defineProperty(exports, "validateFigmaUrl", { enumerable: true, get: function () { return oauth_1.validateFigmaUrl; } });
// Compiler (Figma)
var compiler_1 = require("./compiler");
Object.defineProperty(exports, "FigmaClient", { enumerable: true, get: function () { return compiler_1.FigmaClient; } });
Object.defineProperty(exports, "DesignCompiler", { enumerable: true, get: function () { return compiler_1.DesignCompiler; } });
// Analyzer (Flutter)
var analyzer_1 = require("./analyzer");
Object.defineProperty(exports, "FlutterAnalyzer", { enumerable: true, get: function () { return analyzer_1.FlutterAnalyzer; } });
// Planning Engine
var planning_1 = require("./planning");
Object.defineProperty(exports, "PlanningEngine", { enumerable: true, get: function () { return planning_1.PlanningEngine; } });
// UI Agent
var agent_1 = require("./agent");
Object.defineProperty(exports, "UIAgent", { enumerable: true, get: function () { return agent_1.UIAgent; } });
// Validation
var validation_1 = require("./validation");
Object.defineProperty(exports, "CodeValidator", { enumerable: true, get: function () { return validation_1.CodeValidator; } });
// Integration
var integration_1 = require("./integration");
Object.defineProperty(exports, "ProjectIntegrator", { enumerable: true, get: function () { return integration_1.ProjectIntegrator; } });
// Sync
var sync_1 = require("./sync");
Object.defineProperty(exports, "IncrementalSync", { enumerable: true, get: function () { return sync_1.IncrementalSync; } });
//# sourceMappingURL=index.js.map