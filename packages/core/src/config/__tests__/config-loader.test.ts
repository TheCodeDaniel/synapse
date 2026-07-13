import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { ConfigLoader, createDefaultConfig, loadOrCreateConfig } from '../index';

const ENV_KEYS = ['ANTHROPIC_API_KEY', 'OPENAI_API_KEY', 'DI_CUSTOM_API_KEY'] as const;

describe('ConfigLoader API key resolution', () => {
  const originalEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of ENV_KEYS) {
      originalEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of ENV_KEYS) {
      if (originalEnv[key] === undefined) delete process.env[key];
      else process.env[key] = originalEnv[key];
    }
  });

  it('falls back to ANTHROPIC_API_KEY when ai.apiKey is left blank', () => {
    process.env.ANTHROPIC_API_KEY = 'env-anthropic-key';
    const loader = new ConfigLoader({ ai: { provider: 'anthropic' } as any });

    expect(loader.getConfig().ai.apiKey).toBe('env-anthropic-key');
  });

  it('prefers an explicitly configured apiKey over the environment variable', () => {
    process.env.ANTHROPIC_API_KEY = 'env-anthropic-key';
    const loader = new ConfigLoader({ ai: { provider: 'anthropic', apiKey: 'explicit-key' } as any });

    expect(loader.getConfig().ai.apiKey).toBe('explicit-key');
  });

  it('falls back to DI_CUSTOM_API_KEY for a custom provider', () => {
    process.env.DI_CUSTOM_API_KEY = 'env-custom-key';
    const loader = new ConfigLoader({ ai: { provider: 'custom', baseUrl: 'http://localhost:8000' } as any });

    expect(loader.getConfig().ai.apiKey).toBe('env-custom-key');
  });

  it('createDefaultConfig also resolves the API key from the environment', () => {
    process.env.OPENAI_API_KEY = 'env-openai-key';
    const config = createDefaultConfig('my-app');

    expect(config.ai.apiKey).toBe('env-openai-key');
  });

  it('validate() requires an API key for anthropic and custom providers too, not just openai', () => {
    const loader = new ConfigLoader({
      projectName: 'app',
      figma: { accessToken: 'token' } as any,
      flutter: { projectPath: __dirname } as any,
      ai: { provider: 'anthropic', apiKey: '' } as any,
    });

    const errors = loader.validate();
    expect(errors.some(e => e.toLowerCase().includes('api key'))).toBe(true);
  });
});

describe('ConfigLoader file loading and mutation', () => {
  let tmpDir: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'di-config-'));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('loadFromFile merges the file contents over the defaults', () => {
    const configPath = path.join(tmpDir, 'di.config.json');
    fs.writeFileSync(configPath, JSON.stringify({ projectName: 'from-file', figma: { accessToken: 'file-token' } }));

    const loader = new ConfigLoader();
    const config = loader.loadFromFile(configPath);

    expect(config.projectName).toBe('from-file');
    expect(config.figma.accessToken).toBe('file-token');
    // Untouched defaults should still be present
    expect(config.figma.cacheEnabled).toBe(true);
  });

  it('loadFromFile throws a clear error when the file does not exist', () => {
    const loader = new ConfigLoader();
    expect(() => loader.loadFromFile(path.join(tmpDir, 'missing.json'))).toThrow(/not found/i);
  });

  it('loadFromFile throws a clear error on invalid JSON', () => {
    const configPath = path.join(tmpDir, 'di.config.json');
    fs.writeFileSync(configPath, '{ not valid json');

    const loader = new ConfigLoader();
    expect(() => loader.loadFromFile(configPath)).toThrow(/not valid JSON/i);
  });

  it('setFigmaConfig/setFlutterConfig/setAIConfig shallow-merge into the existing config', () => {
    const loader = new ConfigLoader();

    loader.setFigmaConfig({ accessToken: 'new-token' });
    loader.setFlutterConfig({ projectPath: '/tmp/project' });
    loader.setAIConfig({ model: 'gpt-4o-mini' });

    const config = loader.getConfig();
    expect(config.figma.accessToken).toBe('new-token');
    expect(config.flutter.projectPath).toBe('/tmp/project');
    expect(config.ai.model).toBe('gpt-4o-mini');
  });

  it('getConfig returns a deep copy, not a live reference', () => {
    const loader = new ConfigLoader();
    const config = loader.getConfig();
    config.projectName = 'mutated-externally';

    expect(loader.getConfig().projectName).not.toBe('mutated-externally');
  });

  it('validate() flags a missing project name and a non-existent Flutter project path', () => {
    const loader = new ConfigLoader({
      projectName: '',
      figma: { accessToken: 'token' } as any,
      flutter: { projectPath: path.join(tmpDir, 'does-not-exist') } as any,
      ai: { provider: 'anthropic', apiKey: 'key' } as any,
    });

    const errors = loader.validate();
    expect(errors.some(e => e.toLowerCase().includes('project name'))).toBe(true);
    expect(errors.some(e => e.toLowerCase().includes('does not exist'))).toBe(true);
  });

  it('validate() returns no errors for a fully valid config', () => {
    const loader = new ConfigLoader({
      projectName: 'app',
      figma: { accessToken: 'token' } as any,
      flutter: { projectPath: tmpDir } as any,
      ai: { provider: 'anthropic', apiKey: 'key' } as any,
    });

    expect(loader.validate()).toEqual([]);
  });

  it('loadOrCreateConfig loads an existing di.config.json when present', () => {
    fs.writeFileSync(path.join(tmpDir, 'di.config.json'), JSON.stringify({ projectName: 'existing-project' }));

    const config = loadOrCreateConfig(tmpDir);

    expect(config.projectName).toBe('existing-project');
  });

  it('loadOrCreateConfig creates a default config from the folder name when none exists', () => {
    const config = loadOrCreateConfig(tmpDir);

    expect(config.projectName).toBe(path.basename(tmpDir));
  });
});
