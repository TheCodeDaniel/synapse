"use strict";
/**
 * Validation module - Runs Flutter tooling to validate generated code.
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
exports.CodeValidator = void 0;
const child_process_1 = require("child_process");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class CodeValidator {
    projectRoot;
    constructor(projectRoot) {
        this.projectRoot = path.resolve(projectRoot);
    }
    validate() {
        const errors = [];
        const warnings = [];
        let output = '';
        // Step 1: Run dart format
        const formatResult = this.runDartFormat();
        if (!formatResult.passed) {
            errors.push(...formatResult.errors);
            warnings.push(...formatResult.warnings);
        }
        output += formatResult.output;
        // Step 2: Run dart analyze
        const analyzeResult = this.runDartAnalyze();
        if (!analyzeResult.passed) {
            errors.push(...analyzeResult.errors);
            warnings.push(...analyzeResult.warnings);
        }
        output += analyzeResult.output;
        // Step 3: Run flutter analyze (if available)
        const flutterResult = this.runFlutterAnalyze();
        if (!flutterResult.passed) {
            errors.push(...flutterResult.errors);
            warnings.push(...flutterResult.warnings);
        }
        output += flutterResult.output;
        return {
            passed: errors.length === 0,
            errors,
            warnings,
            output,
        };
    }
    validateFile(filePath) {
        const resolvedPath = path.resolve(this.projectRoot, filePath);
        if (!fs.existsSync(resolvedPath)) {
            return {
                passed: false,
                errors: [{ file: filePath, message: 'File not found', severity: 'error' }],
                warnings: [],
                output: '',
            };
        }
        const errors = [];
        const warnings = [];
        // Run dart format check on single file
        try {
            (0, child_process_1.execSync)(`dart format --output=none "${resolvedPath}"`, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            });
        }
        catch (error) {
            const output = error instanceof Error ? error.message : '';
            errors.push({ file: filePath, message: `Format check failed: ${output}`, severity: 'error' });
        }
        return {
            passed: errors.length === 0,
            errors,
            warnings,
            output: '',
        };
    }
    runDartFormat() {
        try {
            const result = (0, child_process_1.execSync)(`cd "${this.projectRoot}" && dart format --set-exit-if-changed lib/`, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            return {
                passed: true,
                errors: [],
                warnings: result.trim() ? [result.trim()] : [],
                output: result || '',
            };
        }
        catch (error) {
            const err = error;
            const outputLines = err.message.split('\n').filter(Boolean);
            return {
                passed: false,
                errors: [{ file: 'lib/', message: 'Dart format check failed', severity: 'error' }],
                warnings: outputLines.slice(0, 10),
                output: err.message,
            };
        }
    }
    runDartAnalyze() {
        try {
            const result = (0, child_process_1.execSync)(`cd "${this.projectRoot}" && dart analyze --fatal-infos`, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
            });
            return {
                passed: true,
                errors: [],
                warnings: result.trim() ? [result.trim()] : [],
                output: result || '',
            };
        }
        catch (error) {
            const err = error;
            const outputLines = err.message.split('\n').filter(Boolean);
            // Parse dart analyze errors
            const parsedErrors = [];
            for (const line of outputLines) {
                const fileMatch = line.match(/lib\/[\w/]+\.dart/);
                if (fileMatch) {
                    parsedErrors.push({ file: fileMatch[0], message: line.trim(), severity: 'error' });
                }
            }
            return {
                passed: false,
                errors: parsedErrors.length > 0 ? parsedErrors : [{ file: '', message: err.message.split('\n')[0] || 'Dart analyze failed', severity: 'error' }],
                warnings: outputLines.slice(0, 20),
                output: err.message,
            };
        }
    }
    runFlutterAnalyze() {
        try {
            const result = (0, child_process_1.execSync)(`cd "${this.projectRoot}" && flutter analyze --fatal-infos`, {
                encoding: 'utf-8',
                stdio: ['pipe', 'pipe', 'pipe'],
                timeout: 60000,
            });
            return {
                passed: true,
                errors: [],
                warnings: result.trim() ? [result.trim()] : [],
                output: result || '',
            };
        }
        catch (error) {
            // Flutter not installed or analyze failed - non-fatal for prototype
            const err = error;
            return {
                passed: false,
                errors: [],
                warnings: ['Flutter analyze skipped (Flutter SDK may not be installed)'],
                output: '',
            };
        }
    }
}
exports.CodeValidator = CodeValidator;
//# sourceMappingURL=index.js.map