"use strict";
/**
 * Figma OAuth token management.
 * Handles access tokens, refresh, and secure storage.
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.FigmaOAuthManager = void 0;
exports.extractFigmaKey = extractFigmaKey;
exports.validateFigmaUrl = validateFigmaUrl;
const axios_1 = __importDefault(require("axios"));
const crypto_1 = require("crypto");
const FIGMA_API_BASE = 'https://api.figma.com/v1';
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes buffer
class FigmaOAuthManager {
    tokens;
    config;
    storageFn;
    getStorageFn;
    encryptionSecret;
    /**
     * @param encryptionSecret Key material used to derive the AES-256-GCM key
     *   that encrypts tokens at rest. Should come from a real secret store
     *   (e.g. VS Code's `SecretStorage`) or an env var — never hardcoded or
     *   committed. Falls back to `config.clientSecret` if omitted, since that
     *   is still real secret material (just already used for OAuth).
     */
    constructor(config, storage, encryptionSecret) {
        this.config = config;
        this.storageFn = storage?.set;
        this.getStorageFn = storage?.get;
        this.encryptionSecret = encryptionSecret;
        this.loadTokens();
    }
    getAccessToken() {
        if (!this.tokens)
            return null;
        const elapsed = Date.now() - this.tokens.createdAt;
        const remaining = (this.tokens.expiresIn * 1000) - elapsed;
        if (remaining < TOKEN_EXPIRY_BUFFER_MS && this.tokens.refreshToken) {
            return null; // Token will expire soon, trigger refresh
        }
        return this.tokens.accessToken;
    }
    isAuthenticated() {
        return this.getAccessToken() !== null;
    }
    async generateAuthUrl(state) {
        const codeVerifier = (0, crypto_1.randomBytes)(32).toString('base64url');
        const codeChallenge = (0, crypto_1.createHash)('sha256')
            .update(codeVerifier)
            .digest('base64url');
        const authParams = new URLSearchParams({
            response_type: 'code',
            client_id: this.config.clientId,
            redirect_uri: this.config.redirectUri,
            code_challenge: codeChallenge,
            code_challenge_method: 'S256',
            ...(state ? { state } : {}),
        });
        return `https://www.figma.com/oauth?${authParams.toString()}`;
    }
    async exchangeCodeForToken(authCode) {
        const response = await axios_1.default.post('https://api.figma.com/v1/oauth/token', {
            grant_type: 'authorization_code',
            code: authCode,
            redirect_uri: this.config.redirectUri,
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
        }, { headers: { 'Content-Type': 'application/json' } });
        const tokens = {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token,
            expiresIn: response.data.expires_in,
            createdAt: Date.now(),
        };
        this.tokens = tokens;
        this.saveTokens(tokens);
        return tokens;
    }
    async refreshAccessToken() {
        if (!this.tokens?.refreshToken) {
            throw new Error('No refresh token available');
        }
        const response = await axios_1.default.post('https://api.figma.com/v1/oauth/token', {
            grant_type: 'refresh_token',
            refresh_token: this.tokens.refreshToken,
            client_id: this.config.clientId,
            client_secret: this.config.clientSecret,
        }, { headers: { 'Content-Type': 'application/json' } });
        const tokens = {
            accessToken: response.data.access_token,
            refreshToken: response.data.refresh_token ?? this.tokens.refreshToken,
            expiresIn: response.data.expires_in,
            createdAt: Date.now(),
        };
        this.tokens = tokens;
        this.saveTokens(tokens);
        return tokens;
    }
    async callProtectedResource(endpoint) {
        let accessToken = this.getAccessToken();
        if (!accessToken) {
            try {
                await this.refreshAccessToken();
                accessToken = this.getAccessToken();
            }
            catch {
                throw new Error('Failed to authenticate with Figma API');
            }
        }
        const response = await axios_1.default.get(`${FIGMA_API_BASE}${endpoint}`, {
            headers: { 'X-Figma-Token': accessToken },
        });
        return response.data;
    }
    invalidateTokens() {
        this.tokens = undefined;
        this.storageFn?.('di_figma_tokens', undefined);
    }
    setTokens(tokens) {
        this.tokens = tokens;
        this.saveTokens(tokens);
    }
    saveTokens(tokens) {
        if (this.storageFn) {
            const encrypted = this.encryptTokens(tokens);
            this.storageFn('di_figma_tokens', encrypted);
        }
    }
    loadTokens() {
        if (!this.getStorageFn)
            return;
        try {
            const encrypted = this.getStorageFn('di_figma_tokens');
            if (encrypted) {
                this.tokens = this.decryptTokens(encrypted);
            }
        }
        catch {
            this.tokens = undefined;
        }
    }
    deriveKey(salt) {
        const secret = this.encryptionSecret ?? this.config.clientSecret;
        return (0, crypto_1.scryptSync)(secret, salt, 32);
    }
    encryptTokens(tokens) {
        const json = JSON.stringify(tokens);
        const salt = (0, crypto_1.randomBytes)(16);
        const iv = (0, crypto_1.randomBytes)(12);
        const key = this.deriveKey(salt);
        const cipher = (0, crypto_1.createCipheriv)('aes-256-gcm', key, iv);
        const ciphertext = Buffer.concat([cipher.update(json, 'utf-8'), cipher.final()]);
        const authTag = cipher.getAuthTag();
        return [salt, iv, authTag, ciphertext].map(buf => buf.toString('hex')).join(':');
    }
    decryptTokens(encrypted) {
        const [saltHex, ivHex, authTagHex, ciphertextHex] = encrypted.split(':');
        const salt = Buffer.from(saltHex, 'hex');
        const iv = Buffer.from(ivHex, 'hex');
        const authTag = Buffer.from(authTagHex, 'hex');
        const ciphertext = Buffer.from(ciphertextHex, 'hex');
        const key = this.deriveKey(salt);
        const decipher = (0, crypto_1.createDecipheriv)('aes-256-gcm', key, iv);
        decipher.setAuthTag(authTag);
        const json = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
        return JSON.parse(json);
    }
}
exports.FigmaOAuthManager = FigmaOAuthManager;
function extractFigmaKey(url) {
    // Extract file key from various Figma URL formats
    const patterns = [
        /\/file\/([a-zA-Z0-9]+)/, // /file/<key>/view/...
        /\/s\/([a-zA-Z0-9]+)/, // /s/<key>/...
        /\/api\/file\/([a-zA-Z0-9]+)/, // /api/file/<key>...
        /key=([a-zA-Z0-9]+)/, // ?key=<key>
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match?.[1])
            return match[1];
    }
    return null;
}
function validateFigmaUrl(url) {
    try {
        const parsed = new URL(url);
        return parsed.hostname === 'www.figma.com' || parsed.hostname === 'figma.com';
    }
    catch {
        return false;
    }
}
//# sourceMappingURL=figma-oauth.js.map