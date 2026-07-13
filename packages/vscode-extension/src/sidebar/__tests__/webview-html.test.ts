import { getHtml } from '../webview-html';

function fakeWebview() {
  return { cspSource: 'vscode-webview://abc' } as any;
}

describe('getHtml', () => {
  it('returns a non-empty HTML document with the expected interactive elements', () => {
    const html = getHtml(fakeWebview());

    expect(html).toContain('<!DOCTYPE html>');
    expect(html).toContain('Content-Security-Policy');
    for (const id of [
      'figma-token-toggle',
      'ai-key-toggle',
      'analyze-btn',
      'import-btn',
      'figma-url-input',
      'plan-btn',
      'generate-confirm-checkbox',
      'generate-btn',
      'validate-btn',
      'sync-btn',
      'activity-log',
    ]) {
      expect(html).toContain(`id="${id}"`);
    }
  });

  it('uses a fresh nonce on every render (no stale cached script tag)', () => {
    const first = getHtml(fakeWebview());
    const second = getHtml(fakeWebview());

    const nonceOf = (html: string) => html.match(/nonce="([^"]+)"/)?.[1];
    expect(nonceOf(first)).toBeDefined();
    expect(nonceOf(first)).not.toBe(nonceOf(second));
  });
});
