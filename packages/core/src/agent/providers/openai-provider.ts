import axios from 'axios';
import { AIConfig, AppError, createError, err, ErrorCode, ok, Result } from '../../types';
import { LLMCompletionOptions, LLMProvider } from './types';

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

export class OpenAIProvider implements LLMProvider {
  constructor(private readonly config: AIConfig) {}

  async complete(prompt: string, options: LLMCompletionOptions): Promise<Result<string, AppError>> {
    if (!this.config.apiKey) {
      return err(createError(ErrorCode.MISSING_API_KEY, 'OpenAI API key is not configured (set ai.apiKey or OPENAI_API_KEY)'));
    }

    try {
      const response = await axios.post<ChatCompletionResponse>(
        `${this.config.baseUrl ?? DEFAULT_BASE_URL}/chat/completions`,
        {
          model: this.config.model,
          temperature: options.temperature,
          max_tokens: options.maxTokens,
          messages: [{ role: 'user', content: prompt }],
        },
        {
          headers: {
            Authorization: `Bearer ${this.config.apiKey}`,
            'content-type': 'application/json',
          },
        }
      );

      const text = response.data.choices?.[0]?.message?.content;
      if (typeof text !== 'string') {
        return err(createError(ErrorCode.GENERATION_FAILED, 'OpenAI response did not contain message content', response.data));
      }

      return ok(text);
    } catch (error) {
      return err(this.describeError(error));
    }
  }

  private describeError(error: unknown): AppError {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.error?.message ?? error.message;
      return createError(ErrorCode.GENERATION_FAILED, `OpenAI API error: ${message}`);
    }
    return createError(ErrorCode.GENERATION_FAILED, error instanceof Error ? error.message : String(error));
  }
}
