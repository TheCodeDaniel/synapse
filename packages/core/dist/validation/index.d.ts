/**
 * Validation module - Runs Flutter tooling to validate generated code.
 */
import { ValidationError } from '../types';
export interface ValidationResult {
    passed: boolean;
    errors: ValidationError[];
    warnings: string[];
    output: string;
}
export declare class CodeValidator {
    private projectRoot;
    constructor(projectRoot: string);
    validate(): ValidationResult;
    validateFile(filePath: string): ValidationResult;
    private runDartFormat;
    private runDartAnalyze;
    private runFlutterAnalyze;
}
//# sourceMappingURL=index.d.ts.map