"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createProvider = createProvider;
const anthropic_provider_1 = require("./anthropic-provider");
const openai_provider_1 = require("./openai-provider");
const custom_provider_1 = require("./custom-provider");
function createProvider(config) {
    switch (config.provider) {
        case 'anthropic':
            return new anthropic_provider_1.AnthropicProvider(config);
        case 'openai':
            return new openai_provider_1.OpenAIProvider(config);
        case 'custom':
            return new custom_provider_1.CustomProvider(config);
    }
}
//# sourceMappingURL=provider-factory.js.map