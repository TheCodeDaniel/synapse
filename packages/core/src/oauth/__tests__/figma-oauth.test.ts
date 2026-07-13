import { FigmaOAuthManager, FigmaTokens, extractFigmaKey, validateFigmaUrl } from '../figma-oauth';

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

describe('extractFigmaKey', () => {
  it('extracts the key from a modern /design/ URL (current "Copy link" format)', () => {
    // Regression test: Figma switched design-file links from /file/ to
    // /design/ — the original pattern list only recognized /file/, so any
    // link copied from the Figma UI today failed to extract a key at all.
    expect(extractFigmaKey('https://www.figma.com/design/zlED2l5KpqlJr5PE9mxgT7/Nesrea---Ezzek?node-id=0-1&t=abc123-1')).toBe(
      'zlED2l5KpqlJr5PE9mxgT7'
    );
  });

  it('extracts the key from a legacy /file/ URL', () => {
    expect(extractFigmaKey('https://www.figma.com/file/ABC123xyz/My-File')).toBe('ABC123xyz');
  });

  it('extracts the key from a /proto/ prototype URL', () => {
    expect(extractFigmaKey('https://www.figma.com/proto/ABC123xyz/My-File?node-id=1-2')).toBe('ABC123xyz');
  });

  it('extracts the key from a /board/ FigJam URL', () => {
    expect(extractFigmaKey('https://www.figma.com/board/ABC123xyz/My-Board')).toBe('ABC123xyz');
  });

  it('extracts the key from a shortened /s/ URL', () => {
    expect(extractFigmaKey('https://www.figma.com/s/ABC123xyz')).toBe('ABC123xyz');
  });

  it('extracts the key from a ?key= query param', () => {
    expect(extractFigmaKey('https://api.figma.com/v1/images/xyz?key=ABC123xyz')).toBe('ABC123xyz');
  });

  it('returns null when no file key is present', () => {
    expect(extractFigmaKey('https://www.figma.com/community')).toBeNull();
  });
});

describe('validateFigmaUrl', () => {
  it('accepts www.figma.com and figma.com URLs', () => {
    expect(validateFigmaUrl('https://www.figma.com/design/ABC123/Test')).toBe(true);
    expect(validateFigmaUrl('https://figma.com/design/ABC123/Test')).toBe(true);
  });

  it('rejects non-Figma hosts and malformed URLs', () => {
    expect(validateFigmaUrl('https://not-figma.com/design/ABC123/Test')).toBe(false);
    expect(validateFigmaUrl('not a url at all')).toBe(false);
  });
});
