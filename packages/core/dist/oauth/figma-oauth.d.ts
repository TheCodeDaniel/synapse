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
    constructor(config: FigmaOAuthConfig, storage?: {
        set?: (key: string, value?: string) => void;
        get?: (key: string) => string | undefined;
    });
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
    private encryptTokens;
    private decryptTokens;
}
export declare function extractFigmaKey(url: string): string | null;
export declare function validateFigmaUrl(url: string): boolean;
//# sourceMappingURL=figma-oauth.d.ts.map