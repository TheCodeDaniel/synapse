"use strict";
/**
 * Figma API client for fetching design file data.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FigmaClient = void 0;
const axios_1 = __importDefault(require("axios"));
class FigmaClient {
    axiosInstance;
    cache;
    logger;
    constructor(accessToken, cache, logger) {
        this.axiosInstance = axios_1.default.create({
            baseURL: 'https://api.figma.com/v1',
            headers: { 'X-Figma-Token': accessToken },
        });
        this.cache = cache;
        this.logger = logger;
    }
    async getFile(fileKey, depth) {
        const cacheKey = `figma_file_${fileKey}`;
        if (this.cache?.has(cacheKey)) {
            this.logger.debug(`Cache hit for Figma file: ${fileKey}`);
            return this.cache.get(cacheKey);
        }
        try {
            const endpoint = depth ? `/files/${fileKey}?geometry=paths&depth=${depth}` : `/files/${fileKey}`;
            const response = await this.axiosInstance.get(endpoint);
            const data = response.data;
            if (this.cache) {
                this.cache.set(cacheKey, data);
            }
            return data;
        }
        catch (error) {
            const message = this.describeError(error);
            this.logger.error(`Failed to fetch Figma file: ${fileKey}`, message);
            throw new Error(message);
        }
    }
    async getComponents(fileKey, componentIds) {
        if (componentIds.length === 0)
            return [];
        const cacheKey = `figma_components_${componentIds.join(',')}`;
        if (this.cache?.has(cacheKey)) {
            this.logger.debug(`Cache hit for components`);
            return this.cache.get(cacheKey);
        }
        try {
            const idsParam = componentIds.join(',');
            const response = await this.axiosInstance.get(`/components?ids=${idsParam}`);
            const data = response.data;
            if (this.cache) {
                this.cache.set(cacheKey, data.components);
            }
            return data.components;
        }
        catch (error) {
            this.logger.error(`Failed to fetch components`, this.describeError(error));
            return [];
        }
    }
    async getVariables(fileKey) {
        try {
            const response = await this.axiosInstance.get(`/files/${fileKey}/variables/local`);
            return response.data;
        }
        catch (error) {
            this.logger.error(`Failed to fetch variables`, this.describeError(error));
            return { variableCollections: {}, variables: {} };
        }
    }
    async getImage(fileKey, nodeIds, format = 'png', scale = 2) {
        const idsParam = encodeURIComponent(nodeIds);
        const endpoint = `/images/${fileKey}?ids=${idsParam}&format=${format}&scale=${scale}`;
        try {
            const response = await this.axiosInstance.get(endpoint);
            return response.data.images[0];
        }
        catch (error) {
            this.logger.error(`Failed to fetch image for nodes: ${nodeIds}`, this.describeError(error));
            throw new Error(`Figma image API error`);
        }
    }
    invalidateCache(fileKey) {
        if (!this.cache)
            return;
        const prefix = `figma_${fileKey}`;
        // Clear all known cache patterns for this file
        this.cache.delete(`${prefix}`);
    }
    /**
     * Extracts a safe, loggable message from a failed request. Never returns
     * the raw error object — Axios errors embed the full request config,
     * including the `X-Figma-Token` header, and must not be logged verbatim.
     */
    describeError(error) {
        if (axios_1.default.isAxiosError(error)) {
            return `Figma API error: ${error.response?.data?.message ?? error.message}`;
        }
        return error instanceof Error ? error.message : String(error);
    }
}
exports.FigmaClient = FigmaClient;
//# sourceMappingURL=figma-client.js.map