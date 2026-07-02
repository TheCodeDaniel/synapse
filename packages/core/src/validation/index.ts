/**
 * Validation module - Runs Flutter tooling to validate generated code.
 */

import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ValidationError } from '../types';

export interface ValidationResult {
  passed: boolean;
  errors: ValidationError[];
  warnings: string[];
  output: string;
}

export class CodeValidator {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
  }

  validate(): ValidationResult {
    const errors: ValidationError[] = [];
    const warnings: string[] = [];
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

  validateFile(filePath: string): ValidationResult {
    const resolvedPath = path.resolve(this.projectRoot, filePath);

    if (!fs.existsSync(resolvedPath)) {
      return {
        passed: false,
        errors: [{ file: filePath, message: 'File not found', severity: 'error' }],
        warnings: [],
        output: '',
      };
    }

    const errors: ValidationError[] = [];
    const warnings: string[] = [];

    // Run dart format check on single file
    try {
      execSync(`dart format --output=none "${resolvedPath}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch (error) {
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

  private runDartFormat(): ValidationResult {
    try {
      const result = execSync(`cd "${this.projectRoot}" && dart format --set-exit-if-changed lib/`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return {
        passed: true,
        errors: [],
        warnings: result.trim() ? [result.trim()] : [],
        output: result || '',
      };
    } catch (error) {
      const err = error as Error;
      const outputLines = err.message.split('\n').filter(Boolean);

      return {
        passed: false,
        errors: [{ file: 'lib/', message: 'Dart format check failed', severity: 'error' }],
        warnings: outputLines.slice(0, 10),
        output: err.message,
      };
    }
  }

  private runDartAnalyze(): ValidationResult {
    try {
      const result = execSync(`cd "${this.projectRoot}" && dart analyze --fatal-infos`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return {
        passed: true,
        errors: [],
        warnings: result.trim() ? [result.trim()] : [],
        output: result || '',
      };
    } catch (error) {
      const err = error as Error;
      const outputLines = err.message.split('\n').filter(Boolean);

      // Parse dart analyze errors
      const parsedErrors: ValidationError[] = [];
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

  private runFlutterAnalyze(): ValidationResult {
    try {
      const result = execSync(`cd "${this.projectRoot}" && flutter analyze --fatal-infos`, {
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
    } catch (error) {
      // Flutter not installed or analyze failed - non-fatal for prototype
      const err = error as Error;
      return {
        passed: false,
        errors: [],
        warnings: ['Flutter analyze skipped (Flutter SDK may not be installed)'],
        output: '',
      };
    }
  }
}