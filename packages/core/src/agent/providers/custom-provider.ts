import axios from 'axios';
import { AIConfig, AppError, createError, err, ErrorCode, ok, Result } from '../../types';
import { LLMCompletionOptions, LLMProvider } from './types';

interface ChatCompletionResponse {
  choices?: Array<{ message?: { content?: string } }>;
}

/**
 * Talks to any self-hosted / local model that exposes an OpenAI-compatible
 * `/chat/completions` endpoint (e.g. a Qwen deployment behind vLLM or
 * Ollama's OpenAI-compatible API). Requires `ai.baseUrl` — there is no
 * sensible default for "custom".
 */
export class CustomProvider implements LLMProvider {
  constructor(private readonly config: AIConfig) {}

  async complete(prompt: string, options: LLMCompletionOptions): Promise<Result<string, AppError>> {
    if (!this.config.baseUrl) {
      return err(createError(ErrorCode.INVALID_CONFIG, 'A custom AI provider requires ai.baseUrl to be set'));
    }
    if (!this.config.apiKey) {
      return err(createError(ErrorCode.MISSING_API_KEY, 'Custom provider API key is not configured (set ai.apiKey or DI_CUSTOM_API_KEY)'));
    }

    try {
      const response = await axios.post<ChatCompletionResponse>(
        `${this.config.baseUrl}/chat/completions`,
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
        return err(createError(ErrorCode.GENERATION_FAILED, 'Custom provider response did not contain message content', response.data));
      }

      return ok(text);
    } catch (error) {
      return err(this.describeError(error));
    }
  }

  private describeError(error: unknown): AppError {
    if (axios.isAxiosError(error)) {
      const message = error.response?.data?.error?.message ?? error.message;
      return createError(ErrorCode.GENERATION_FAILED, `Custom provider API error: ${message}`);
    }
    return createError(ErrorCode.GENERATION_FAILED, error instanceof Error ? error.message : String(error));
  }
}
