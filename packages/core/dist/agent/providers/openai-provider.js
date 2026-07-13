"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenAIProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const types_1 = require("../../types");
const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
class OpenAIProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    async complete(prompt, options) {
        if (!this.config.apiKey) {
            return (0, types_1.err)((0, types_1.createError)(types_1.ErrorCode.MISSING_API_KEY, 'OpenAI API key is not configured (set ai.apiKey or OPENAI_API_KEY)'));
        }
        try {
            const response = await axios_1.default.post(`${this.config.baseUrl ?? DEFAULT_BASE_URL}/chat/completions`, {
                model: this.config.model,
                temperature: options.temperature,
                max_tokens: options.maxTokens,
                messages: [{ role: 'user', content: prompt }],
            }, {
                headers: {
                    Authorization: `Bearer ${this.config.apiKey}`,
                    'content-type': 'application/json',
                },
            });
            const text = response.data.choices?.[0]?.message?.content;
            if (typeof text !== 'string') {
                return (0, types_1.err)((0, types_1.createError)(types_1.ErrorCode.GENERATION_FAILED, 'OpenAI response did not contain message content', response.data));
            }
            return (0, types_1.ok)(text);
        }
        catch (error) {
            return (0, types_1.err)(this.describeError(error));
        }
    }
    describeError(error) {
        if (axios_1.default.isAxiosError(error)) {
            const message = error.response?.data?.error?.message ?? error.message;
            return (0, types_1.createError)(types_1.ErrorCode.GENERATION_FAILED, `OpenAI API error: ${message}`);
        }
        return (0, types_1.createError)(types_1.ErrorCode.GENERATION_FAILED, error instanceof Error ? error.message : String(error));
    }
}
exports.OpenAIProvider = OpenAIProvider;
//# sourceMappingURL=openai-provider.js.map