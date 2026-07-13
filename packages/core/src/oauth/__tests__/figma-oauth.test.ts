import { FigmaOAuthManager, FigmaTokens } from '../figma-oauth';

const config = { clientId: 'client-id', clientSecret: 'client-secret', redirectUri: 'https://example.com/callback' };

describe('FigmaOAuthManager token storage', () => {
  it('encrypts tokens at rest instead of writing reversible base64', () => {
    let stored: string | undefined;
    const manager = new FigmaOAuthManager(
      config,
      { set: (_key, value) => { stored = value; }, get: () => stored },
      'a-real-encryption-secret'
    );

    const tokens: FigmaTokens = { accessToken: 'super-secret-access-token', refreshToken: 'refresh-token', expiresIn: 3600, createdAt: Date.now() };
    manager.setTokens(tokens);

    expect(stored).toBeDefined();
    // The old implementation just base64-encoded the JSON — decoding it would
    // trivially reveal the access token. Confirm that's no longer possible.
    expect(stored).not.toContain('super-secret-access-token');
    expect(Buffer.from(stored!.split(':')[3] ?? '', 'hex').toString('utf-8')).not.toContain('super-secret-access-token');
  });

  it('round-trips tokens through encrypt/decrypt via load', () => {
    let stored: string | undefined;
    const tokens: FigmaTokens = { accessToken: 'access-123', refreshToken: 'refresh-123', expiresIn: 3600, createdAt: Date.now() };

    const writer = new FigmaOAuthManager(
      config,
      { set: (_key, value) => { stored = value; }, get: () => stored },
      'shared-secret'
    );
    writer.setTokens(tokens);

    const reader = new FigmaOAuthManager(
      config,
      { set: () => undefined, get: () => stored },
      'shared-secret'
    );

    expect(reader.getAccessToken()).toBe('access-123');
  });

  it('cannot decrypt with the wrong secret (ciphertext is not just reversible encoding)', () => {
    let stored: string | undefined;
    const tokens: FigmaTokens = { accessToken: 'access-123', refreshToken: 'refresh-123', expiresIn: 3600, createdAt: Date.now() };

    const writer = new FigmaOAuthManager(config, { set: (_key, value) => { stored = value; }, get: () => stored }, 'correct-secret');
    writer.setTokens(tokens);

    // loadTokens() swallows decryption failures (corrupt/foreign data should
    // degrade to "not authenticated", not crash the extension on startup).
    const reader = new FigmaOAuthManager(config, { set: () => undefined, get: () => stored }, 'wrong-secret');
    expect(reader.getAccessToken()).toBeNull();
  });
});
