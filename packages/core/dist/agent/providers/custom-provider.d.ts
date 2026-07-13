import { AIConfig, AppError, Result } from '../../types';
import { LLMCompletionOptions, LLMProvider } from './types';
/**
 * Talks to any self-hosted / local model that exposes an OpenAI-compatible
 * `/chat/completions` endpoint (e.g. a Qwen deployment behind vLLM or
 * Ollama's OpenAI-compatible API). Requires `ai.baseUrl` — there is no
 * sensible default for "custom".
 */
export declare class CustomProvider implements LLMProvider {
    private readonly config;
    constructor(config: AIConfig);
    complete(prompt: string, options: LLMCompletionOptions): Promise<Result<string, AppError>>;
    private describeError;
}
//# sourceMappingURL=custom-provider.d.ts.map