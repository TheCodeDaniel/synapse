/**
 * Figma OAuth token management.
 * Handles access tokens, refresh, and secure storage.
 */
export interface FigmaTokens {
    accessToken: string;
    refreshToken?: string;
    expiresIn: number;
    createdAt: number;
}
export interface FigmaOAuthConfig {
    clientId: string;
    clientSecret: string;
    redirectUri: string;
}
export declare class FigmaOAuthManager {
    private tokens?;
    private config;
    private storageFn?;
    private getStorageFn?;
    private encryptionSecret?;
    /**
     * @param encryptionSecret Key material used to derive the AES-256-GCM key
     *   that encrypts tokens at rest. Should come from a real secret store
     *   (e.g. VS Code's `SecretStorage`) or an env var — never hardcoded or
     *   committed. Falls back to `config.clientSecret` if omitted, since that
     *   is still real secret material (just already used for OAuth).
     */
    constructor(config: FigmaOAuthConfig, storage?: {
        set?: (key: string, value?: string) => void;
        get?: (key: string) => string | undefined;
    }, encryptionSecret?: string);
    getAccessToken(): string | null;
    isAuthenticated(): boolean;
    generateAuthUrl(state?: string): Promise<string>;
    exchangeCodeForToken(authCode: string): Promise<FigmaTokens>;
    refreshAccessToken(): Promise<FigmaTokens>;
    callProtectedResource<T>(endpoint: string): Promise<T>;
    invalidateTokens(): void;
    setTokens(tokens: FigmaTokens): void;
    private saveTokens;
    private loadTokens;
    private deriveKey;
    private encryptTokens;
    private decryptTokens;
}
export declare function extractFigmaKey(url: string): string | null;
export declare function validateFigmaUrl(url: string): boolean;
//# sourceMappingURL=figma-oauth.d.ts.map