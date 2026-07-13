import { AIConfig } from '../../types';
import { LLMProvider } from './types';
import { AnthropicProvider } from './anthropic-provider';
import { OpenAIProvider } from './openai-provider';
import { CustomProvider } from './custom-provider';

export function createProvider(config: AIConfig): LLMProvider {
  switch (config.provider) {
    case 'anthropic':
      return new AnthropicProvider(config);
    case 'openai':
      return new OpenAIProvider(config);
    case 'custom':
      return new CustomProvider(config);
  }
}
