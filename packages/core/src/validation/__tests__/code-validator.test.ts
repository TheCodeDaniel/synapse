import * as fs from 'fs';
import * as path from 'path';
import { CodeValidator } from '../index';

const FIXTURES_DIR = path.join(__dirname, 'fixtures');
const TIMEOUT_MS = 30_000; // spawns real `dart`/`flutter` CLI processes

describe('CodeValidator', () => {
  it(
    'reports unformatted files with real per-file paths (not the old hardcoded "lib/")',
    () => {
      const validator = new CodeValidator(path.join(FIXTURES_DIR, 'unformatted-project'));

      const result = validator.validate();

      expect(result.passed).toBe(false);
      const formatError = result.errors.find(e => e.file.endsWith('bad.dart'));
      expect(formatError).toBeDefined();
    },
    TIMEOUT_MS
  );

  it(
    'does not rewrite source files as a side effect of validation (dart format used to run without -o none)',
    () => {
      const fixtureDir = path.join(FIXTURES_DIR, 'unformatted-project');
      const filePath = path.join(fixtureDir, 'lib', 'bad.dart');
      const before = fs.readFileSync(filePath, 'utf-8');

      new CodeValidator(fixtureDir).validate();

      const after = fs.readFileSync(filePath, 'utf-8');
      expect(after).toBe(before);
    },
    TIMEOUT_MS
  );

  it(
    'parses real file/line/column/severity from dart analyze output (previously always undefined)',
    () => {
      const validator = new CodeValidator(path.join(FIXTURES_DIR, 'analyze-error-project'));

      const result = validator.validate();

      expect(result.passed).toBe(false);
      const analyzeError = result.errors.find(e => e.message.includes('undefinedThing'));
      expect(analyzeError).toBeDefined();
      expect(analyzeError?.file).toContain('main.dart');
      expect(analyzeError?.line).toBe(2);
      expect(analyzeError?.column).toBeGreaterThan(0);
      expect(analyzeError?.severity).toBe('error');
    },
    TIMEOUT_MS
  );

  it(
    'passes for a properly formatted project with no analyzer issues',
    () => {
      const validator = new CodeValidator(path.join(FIXTURES_DIR, 'clean-project'));

      const result = validator.validate();

      expect(result.passed).toBe(true);
      expect(result.errors).toEqual([]);
    },
    TIMEOUT_MS
  );

  it(
    'validateFile reports a single unformatted file without rewriting it',
    () => {
      const fixtureDir = path.join(FIXTURES_DIR, 'unformatted-project');
      const filePath = path.join(fixtureDir, 'lib', 'bad.dart');
      const before = fs.readFileSync(filePath, 'utf-8');

      const result = new CodeValidator(fixtureDir).validateFile('lib/bad.dart');

      expect(result.passed).toBe(false);
      expect(result.errors[0].file).toBe('lib/bad.dart');
      expect(fs.readFileSync(filePath, 'utf-8')).toBe(before);
    },
    TIMEOUT_MS
  );

  it('reports a clear error for a file that does not exist', () => {
    const validator = new CodeValidator(path.join(FIXTURES_DIR, 'clean-project'));

    const result = validator.validateFile('lib/does_not_exist.dart');

    expect(result.passed).toBe(false);
    expect(result.errors[0].message).toBe('File not found');
  });
});
