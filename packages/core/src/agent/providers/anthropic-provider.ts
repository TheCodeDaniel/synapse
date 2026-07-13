import axios from 'axios';
import { AIConfig, AppError, createError, err, ErrorCode, ok, Result } from '../../types';
import { LLMCompletionOptions, LLMProvider } from './types';

const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';

interface AnthropicMessagesResponse {
  content?: Array<{ type: string; text?: string }>;
}

export class AnthropicProvider implements LLMProvider {
  constructor(private readonly config: AIConfig) {}

  async complete(prompt: string, options: LLMCompletionOptions): Promise<Result<string, AppError>> {
    if (!this.config.apiKey) {
      return err(createError(ErrorCode.MISSING_API_KEY, 'Anthropic API key is not configured (set ai.apiKey or ANTHROPIC_API_KEY)'));
    }

    try {
      const response = await axios.post<AnthropicMessagesResponse>(
        `${this.config.baseUrl ?? DEFAULT_BASE_URL}/v1/messages`,
        {
          model: this.config.model,
          max_tokens: options.maxTokens,
          temperature: options.temperature,
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            'x-api-key': this.config.apiKey,
            'anthropic-version': ANTHROPIC_VERSION,
            'content-type': 'application/json',
          },
        }
      );

      const text = response.data.content?.find(block => block.type === 'text')?.text;
      if (typeof text !== 'string') {
        return err(createError(ErrorCode.GENERATION_FAILED, 'Anthropic response did not contain a text block', response.data));
      }

      return ok(text);
    } catch (error) {
      return err(this.describeError(error));
    }
  }

  private describeError(error: unknown): AppError {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.error?.message ?? error.message;
      return createError(ErrorCode.GENERATION_FAILED, `Anthropic API error: ${message}`);
    }
    return createError(ErrorCode.GENERATION_FAILED, error instanceof Error ? error.message : String(error));
  }
}
