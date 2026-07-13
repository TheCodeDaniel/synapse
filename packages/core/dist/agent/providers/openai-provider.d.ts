import { AIConfig, AppError, Result } from '../../types';
import { LLMCompletionOptions, LLMProvider } from './types';
export declare class OpenAIProvider implements LLMProvider {
    private readonly config;
    constructor(config: AIConfig);
    complete(prompt: string, options: LLMCompletionOptions): Promise<Result<string, AppError>>;
    private describeError;
}
//# sourceMappingURL=openai-provider.d.ts.map