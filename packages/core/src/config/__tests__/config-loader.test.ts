import { ConfigLoader, createDefaultConfig } from '../index';

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
