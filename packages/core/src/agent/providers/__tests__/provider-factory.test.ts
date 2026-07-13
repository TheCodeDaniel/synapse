import { createProvider } from '../provider-factory';
import { AnthropicProvider } from '../anthropic-provider';
import { OpenAIProvider } from '../openai-provider';
import { CustomProvider } from '../custom-provider';
import { AIConfig } from '../../../types';

function buildConfig(overrides: Partial<AIConfig>): AIConfig {
  return { provider: 'openai', apiKey: 'k', model: 'm', temperature: 0.2, maxTokens: 1024, ...overrides };
}

describe('createProvider', () => {
  it('creates an AnthropicProvider for provider: anthropic', () => {
    expect(createProvider(buildConfig({ provider: 'anthropic' }))).toBeInstanceOf(AnthropicProvider);
  });

  it('creates an OpenAIProvider for provider: openai', () => {
    expect(createProvider(buildConfig({ provider: 'openai' }))).toBeInstanceOf(OpenAIProvider);
  });

  it('creates a CustomProvider for provider: custom', () => {
    expect(createProvider(buildConfig({ provider: 'custom' }))).toBeInstanceOf(CustomProvider);
  });
});
