import { AIConfig, AppError, Result } from '../../types';
import { LLMCompletionOptions, LLMProvider } from './types';
export declare class AnthropicProvider implements LLMProvider {
    private readonly config;
    constructor(config: AIConfig);
    complete(prompt: string, options: LLMCompletionOptions): Promise<Result<string, AppError>>;
    private describeError;
}
//# sourceMappingURL=anthropic-provider.d.ts.map