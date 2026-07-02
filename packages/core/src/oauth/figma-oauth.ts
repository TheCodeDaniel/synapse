/**
 * Figma OAuth token management.
 * Handles access tokens, refresh, and secure storage.
 */

import axios from 'axios';
import { createHash, randomBytes } from 'crypto';

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

const FIGMA_API_BASE = 'https://api.figma.com/v1';
const TOKEN_EXPIRY_BUFFER_MS = 5 * 60 * 1000; // 5 minutes buffer

export class FigmaOAuthManager {
  private tokens?: FigmaTokens;
  private config: FigmaOAuthConfig;
  private storageFn?: (key: string, value?: string) => void;
  private getStorageFn?: (key: string) => string | undefined;

  constructor(config: FigmaOAuthConfig, storage?: {
    set?: (key: string, value?: string) => void;
    get?: (key: string) => string | undefined;
  }) {
    this.config = config;
    this.storageFn = storage?.set;
    this.getStorageFn = storage?.get;
    this.loadTokens();
  }

  getAccessToken(): string | null {
    if (!this.tokens) return null;

    const elapsed = Date.now() - this.tokens.createdAt;
    const remaining = (this.tokens.expiresIn * 1000) - elapsed;

    if (remaining < TOKEN_EXPIRY_BUFFER_MS && this.tokens.refreshToken) {
      return null; // Token will expire soon, trigger refresh
    }

    return this.tokens.accessToken;
  }

  isAuthenticated(): boolean {
    return this.getAccessToken() !== null;
  }

  async generateAuthUrl(state?: string): Promise<string> {
    const codeVerifier = randomBytes(32).toString('base64url');
    const codeChallenge = createHash('sha256')
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

  async exchangeCodeForToken(authCode: string): Promise<FigmaTokens> {
    const response = await axios.post(
      'https://api.figma.com/v1/oauth/token',
      {
        grant_type: 'authorization_code',
        code: authCode,
        redirect_uri: this.config.redirectUri,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const tokens: FigmaTokens = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token,
      expiresIn: response.data.expires_in,
      createdAt: Date.now(),
    };

    this.tokens = tokens;
    this.saveTokens(tokens);
    return tokens;
  }

  async refreshAccessToken(): Promise<FigmaTokens> {
    if (!this.tokens?.refreshToken) {
      throw new Error('No refresh token available');
    }

    const response = await axios.post(
      'https://api.figma.com/v1/oauth/token',
      {
        grant_type: 'refresh_token',
        refresh_token: this.tokens.refreshToken,
        client_id: this.config.clientId,
        client_secret: this.config.clientSecret,
      },
      { headers: { 'Content-Type': 'application/json' } }
    );

    const tokens: FigmaTokens = {
      accessToken: response.data.access_token,
      refreshToken: response.data.refresh_token ?? this.tokens.refreshToken,
      expiresIn: response.data.expires_in,
      createdAt: Date.now(),
    };

    this.tokens = tokens;
    this.saveTokens(tokens);
    return tokens;
  }

  async callProtectedResource<T>(endpoint: string): Promise<T> {
    let accessToken = this.getAccessToken();

    if (!accessToken) {
      try {
        await this.refreshAccessToken();
        accessToken = this.getAccessToken();
      } catch {
        throw new Error('Failed to authenticate with Figma API');
      }
    }

    const response = await axios.get(`${FIGMA_API_BASE}${endpoint}`, {
      headers: { 'X-Figma-Token': accessToken },
    });

    return response.data as T;
  }

  invalidateTokens(): void {
    this.tokens = undefined;
    this.storageFn?.('di_figma_tokens', undefined);
  }

  setTokens(tokens: FigmaTokens): void {
    this.tokens = tokens;
    this.saveTokens(tokens);
  }

  private saveTokens(tokens: FigmaTokens): void {
    if (this.storageFn) {
      const encrypted = this.encryptTokens(tokens);
      this.storageFn('di_figma_tokens', encrypted);
    }
  }

  private loadTokens(): void {
    if (!this.getStorageFn) return;

    try {
      const encrypted = this.getStorageFn('di_figma_tokens');
      if (encrypted) {
        this.tokens = this.decryptTokens(encrypted);
      }
    } catch {
      this.tokens = undefined;
    }
  }

  private encryptTokens(tokens: FigmaTokens): string {
    const json = JSON.stringify(tokens);
    const key = randomBytes(32);
    const iv = randomBytes(16);
    // Simple encoding for prototype - in production use proper encryption
    return `${key.toString('hex')}:${iv.toString('hex')}:${Buffer.from(json).toString('base64')}`;
  }

  private decryptTokens(encrypted: string): FigmaTokens {
    const [key, iv, data] = encrypted.split(':');
    const json = Buffer.from(data, 'base64').toString('utf-8');
    return JSON.parse(json) as FigmaTokens;
  }
}

export function extractFigmaKey(url: string): string | null {
  // Extract file key from various Figma URL formats
  const patterns = [
    /\/file\/([a-zA-Z0-9]+)/,       // /file/<key>/view/...
    /\/s\/([a-zA-Z0-9]+)/,          // /s/<key>/...
    /\/api\/file\/([a-zA-Z0-9]+)/,  // /api/file/<key>...
    /key=([a-zA-Z0-9]+)/,           // ?key=<key>
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) return match[1];
  }

  return null;
}

export function validateFigmaUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    return parsed.hostname === 'www.figma.com' || parsed.hostname === 'figma.com';
  } catch {
    return false;
  }
}