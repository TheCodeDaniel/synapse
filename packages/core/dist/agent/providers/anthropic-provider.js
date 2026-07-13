"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnthropicProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const types_1 = require("../../types");
const DEFAULT_BASE_URL = 'https://api.anthropic.com';
const ANTHROPIC_VERSION = '2023-06-01';
class AnthropicProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    async complete(prompt, options) {
        if (!this.config.apiKey) {
            return (0, types_1.err)((0, types_1.createError)(types_1.ErrorCode.MISSING_API_KEY, 'Anthropic API key is not configured (set ai.apiKey or ANTHROPIC_API_KEY)'));
        }
        try {
            const response = await axios_1.default.post(`${this.config.baseUrl ?? DEFAULT_BASE_URL}/v1/messages`, {
                model: this.config.model,
                max_tokens: options.maxTokens,
                temperature: options.temperature,
                messages: [{ role: 'user', content: prompt }],
            }, {
                headers: {
                    'x-api-key': this.config.apiKey,
                    'anthropic-version': ANTHROPIC_VERSION,
                    'content-type': 'application/json',
                },
            });
            const text = response.data.content?.find(block => block.type === 'text')?.text;
            if (typeof text !== 'string') {
                return (0, types_1.err)((0, types_1.createError)(types_1.ErrorCode.GENERATION_FAILED, 'Anthropic response did not contain a text block', response.data));
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
            return (0, types_1.createError)(types_1.ErrorCode.GENERATION_FAILED, `Anthropic API error: ${message}`);
        }
        return (0, types_1.createError)(types_1.ErrorCode.GENERATION_FAILED, error instanceof Error ? error.message : String(error));
    }
}
exports.AnthropicProvider = AnthropicProvider;
//# sourceMappingURL=anthropic-provider.js.map