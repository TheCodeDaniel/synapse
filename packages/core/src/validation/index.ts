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

/** The shape Node actually populates on the Error thrown by a failed execSync call. */
interface ExecError extends Error {
  status?: number;
  stdout?: string;
  stderr?: string;
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

    // `-o none` is a dry run — it reports whether the file would change
    // without writing to disk. Without it, `dart format` rewrites the file
    // in place, which is a surprising side effect for something called
    // "validate".
    try {
      execSync(`dart format --set-exit-if-changed -o none "${resolvedPath}"`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });
    } catch {
      errors.push({ file: filePath, message: 'File is not formatted according to dart format', severity: 'error' });
    }

    return {
      passed: errors.length === 0,
      errors,
      warnings: [],
      output: '',
    };
  }

  private runDartFormat(): ValidationResult {
    try {
      const result = execSync(`cd "${this.projectRoot}" && dart format --set-exit-if-changed -o none lib/`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return { passed: true, errors: [], warnings: [], output: result || '' };
    } catch (error) {
      // execSync's thrown Error only puts "Command failed: <cmd>" in
      // `.message` — the actual `dart format` output (the list of changed
      // files) is on `.stdout`. Reading `.message` here previously meant
      // this branch could never see real file paths at all.
      const err = error as ExecError;
      const stdout = err.stdout ?? '';
      const changedFiles = this.parseChangedFiles(stdout);

      return {
        passed: false,
        errors:
          changedFiles.length > 0
            ? changedFiles.map(file => ({ file, message: 'File is not formatted according to dart format', severity: 'error' as const }))
            : [{ file: 'lib/', message: 'Dart format check failed', severity: 'error' }],
        warnings: [],
        output: stdout || err.message,
      };
    }
  }

  private parseChangedFiles(output: string): string[] {
    const files: string[] = [];
    for (const line of output.split('\n')) {
      const match = line.match(/^(?:Changed|Formatted)\s+(\S+\.dart)\s*$/);
      if (match) files.push(match[1]);
    }
    return files;
  }

  private runDartAnalyze(): ValidationResult {
    try {
      const result = execSync(`cd "${this.projectRoot}" && dart analyze --fatal-infos`, {
        encoding: 'utf-8',
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      return { passed: true, errors: [], warnings: [], output: result || '' };
    } catch (error) {
      // Same `.message`-vs-`.stdout` issue as runDartFormat — `dart
      // analyze`'s per-issue report is on stdout, not the thrown error's
      // message, so the previous regex against `.message` never matched.
      const err = error as ExecError;
      const stdout = err.stdout ?? '';
      const parsedErrors = this.parseAnalyzerOutput(stdout);

      return {
        passed: false,
        errors: parsedErrors.length > 0 ? parsedErrors : [{ file: '', message: stdout.trim() || err.message, severity: 'error' }],
        warnings: [],
        output: stdout || err.message,
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

      return { passed: true, errors: [], warnings: [], output: result || '' };
    } catch (error) {
      const err = error as ExecError;
      const stdout = err.stdout ?? '';
      const parsedErrors = this.parseAnalyzerOutput(stdout);

      if (parsedErrors.length > 0) {
        return { passed: false, errors: parsedErrors, warnings: [], output: stdout };
      }

      // No parseable analyzer output at all — the command most likely
      // failed to run (Flutter SDK not installed, timed out) rather than
      // finding real issues, so this stays non-fatal instead of treating a
      // missing SDK the same as a real analysis failure.
      return {
        passed: false,
        errors: [],
        warnings: ['Flutter analyze skipped or failed to produce output (Flutter SDK may not be installed)'],
        output: stdout,
      };
    }
  }

  /**
   * Parses both `dart analyze` and `flutter analyze` issue lines. The two
   * tools use different separators/field order for the same information —
   * verified against a real Dart 3.11 / Flutter 3.41 SDK:
   *   dart:    "  error - lib/foo.dart:12:34 - Message here. - lint_rule"
   *   flutter: "  error • Message here • lib/foo.dart:12:34 • lint_rule"
   */
  private parseAnalyzerOutput(output: string): ValidationError[] {
    const errors: ValidationError[] = [];
    for (const line of output.split('\n')) {
      const parsed = this.parseAnalyzerLine(line);
      if (parsed) errors.push(parsed);
    }
    return errors;
  }

  private parseAnalyzerLine(line: string): ValidationError | null {
    const dashFormat = line.match(/^\s*(error|warning|info)\s-\s(\S+):(\d+):(\d+)\s-\s(.+)\s-\s(\S+)\s*$/);
    if (dashFormat) {
      const [, severity, file, lineNo, col, message] = dashFormat;
      return { file, line: Number(lineNo), column: Number(col), message: message.trim(), severity: this.mapSeverity(severity) };
    }

    const bulletFormat = line.match(/^\s*(error|warning|info)\s•\s(.+?)\s•\s(\S+):(\d+):(\d+)\s•\s(\S+)\s*$/);
    if (bulletFormat) {
      const [, severity, message, file, lineNo, col] = bulletFormat;
      return { file, line: Number(lineNo), column: Number(col), message: message.trim(), severity: this.mapSeverity(severity) };
    }

    return null;
  }

  /** `ValidationError.severity` only models 'error' | 'warning' — analyzer 'info' issues are surfaced as warnings rather than silently dropped. */
  private mapSeverity(rawSeverity: string): 'error' | 'warning' {
    return rawSeverity === 'error' ? 'error' : 'warning';
  }
}
