/**
 * Figma OAuth token management.
 * Handles access tokens, refresh, and secure storage.
 */

import axios from 'axios';
import { createCipheriv, createDecipheriv, createHash, randomBytes, scryptSync } from 'crypto';

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
  private encryptionSecret?: string;

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
  }, encryptionSecret?: string) {
    this.config = config;
    this.storageFn = storage?.set;
    this.getStorageFn = storage?.get;
    this.encryptionSecret = encryptionSecret;
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

  private deriveKey(salt: Buffer): Buffer {
    const secret = this.encryptionSecret ?? this.config.clientSecret;
    return scryptSync(secret, salt, 32);
  }

  private encryptTokens(tokens: FigmaTokens): string {
    const json = JSON.stringify(tokens);
    const salt = randomBytes(16);
    const iv = randomBytes(12);
    const key = this.deriveKey(salt);

    const cipher = createCipheriv('aes-256-gcm', key, iv);
    const ciphertext = Buffer.concat([cipher.update(json, 'utf-8'), cipher.final()]);
    const authTag = cipher.getAuthTag();

    return [salt, iv, authTag, ciphertext].map(buf => buf.toString('hex')).join(':');
  }

  private decryptTokens(encrypted: string): FigmaTokens {
    const [saltHex, ivHex, authTagHex, ciphertextHex] = encrypted.split(':');
    const salt = Buffer.from(saltHex, 'hex');
    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');
    const ciphertext = Buffer.from(ciphertextHex, 'hex');
    const key = this.deriveKey(salt);

    const decipher = createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(authTag);
    const json = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf-8');
    return JSON.parse(json) as FigmaTokens;
  }
}

export function extractFigmaKey(url: string): string | null {
  // Extract file key from various Figma URL formats. Figma has used several
  // path prefixes over time — "/file/" is the legacy one; current "Copy
  // link" from the Figma UI produces "/design/" for design files, plus
  // "/proto/" (prototype presentation view), "/board/" (FigJam), and
  // "/slides/" (Figma Slides) — all followed by the same file key shape.
  const patterns = [
    /\/(?:file|design|proto|board|slides)\/([a-zA-Z0-9]+)/,
    /\/s\/([a-zA-Z0-9]+)/,          // /s/<key>/... (shortened links)
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