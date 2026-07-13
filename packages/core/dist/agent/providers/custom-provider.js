"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CustomProvider = void 0;
const axios_1 = __importDefault(require("axios"));
const types_1 = require("../../types");
/**
 * Talks to any self-hosted / local model that exposes an OpenAI-compatible
 * `/chat/completions` endpoint (e.g. a Qwen deployment behind vLLM or
 * Ollama's OpenAI-compatible API). Requires `ai.baseUrl` — there is no
 * sensible default for "custom".
 */
class CustomProvider {
    config;
    constructor(config) {
        this.config = config;
    }
    async complete(prompt, options) {
        if (!this.config.baseUrl) {
            return (0, types_1.err)((0, types_1.createError)(types_1.ErrorCode.INVALID_CONFIG, 'A custom AI provider requires ai.baseUrl to be set'));
        }
        if (!this.config.apiKey) {
            return (0, types_1.err)((0, types_1.createError)(types_1.ErrorCode.MISSING_API_KEY, 'Custom provider API key is not configured (set ai.apiKey or DI_CUSTOM_API_KEY)'));
        }
        try {
            const response = await axios_1.default.post(`${this.config.baseUrl}/chat/completions`, {
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
                return (0, types_1.err)((0, types_1.createError)(types_1.ErrorCode.GENERATION_FAILED, 'Custom provider response did not contain message content', response.data));
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
            return (0, types_1.createError)(types_1.ErrorCode.GENERATION_FAILED, `Custom provider API error: ${message}`);
        }
        return (0, types_1.createError)(types_1.ErrorCode.GENERATION_FAILED, error instanceof Error ? error.message : String(error));
    }
}
exports.CustomProvider = CustomProvider;
//# sourceMappingURL=custom-provider.js.map