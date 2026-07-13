import { AppError, Result } from '../../types';
export interface LLMCompletionOptions {
    temperature: number;
    maxTokens: number;
}
/**
 * A model-agnostic chat-completion backend. Implementations wrap a single
 * provider's REST API (Anthropic, OpenAI, or an OpenAI-compatible custom
 * endpoint) behind one shape so `UIAgent` never has to know which provider
 * it's talking to.
 */
export interface LLMProvider {
    complete(prompt: string, options: LLMCompletionOptions): Promise<Result<string, AppError>>;
}
//# sourceMappingURL=types.d.ts.map