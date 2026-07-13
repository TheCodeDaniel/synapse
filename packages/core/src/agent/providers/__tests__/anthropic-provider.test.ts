import axios from 'axios';
import { AnthropicProvider } from '../anthropic-provider';
import { AIConfig } from '../../../types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function buildConfig(overrides: Partial<AIConfig> = {}): AIConfig {
  return { provider: 'anthropic', apiKey: 'test-key', model: 'claude-x', temperature: 0.2, maxTokens: 1024, ...overrides };
}

describe('AnthropicProvider', () => {
  it('returns the text block on success', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { content: [{ type: 'text', text: 'class Foo {}' }] } });
    const provider = new AnthropicProvider(buildConfig());

    const result = await provider.complete('prompt', { temperature: 0.2, maxTokens: 1024 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('class Foo {}');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.anthropic.com/v1/messages',
      expect.objectContaining({ model: 'claude-x' }),
      expect.objectContaining({ headers: expect.objectContaining({ 'x-api-key': 'test-key' }) })
    );
  });

  it('returns a Result error (not a throw) when no API key is configured', async () => {
    const provider = new AnthropicProvider(buildConfig({ apiKey: '' }));

    const result = await provider.complete('prompt', { temperature: 0.2, maxTokens: 1024 });

    expect(result.ok).toBe(false);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('wraps a failed HTTP call into a Result error instead of throwing', async () => {
    mockedAxios.isAxiosError.mockReturnValue(true);
    mockedAxios.post.mockRejectedValueOnce({
      isAxiosError: true,
      message: 'Request failed with status code 401',
      response: { data: { error: { message: 'invalid_api_key' } } },
    });
    const provider = new AnthropicProvider(buildConfig());

    const result = await provider.complete('prompt', { temperature: 0.2, maxTokens: 1024 });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.message).toContain('invalid_api_key');
  });

  it('respects a custom baseUrl override', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { content: [{ type: 'text', text: 'ok' }] } });
    const provider = new AnthropicProvider(buildConfig({ baseUrl: 'http://localhost:9999' }));

    await provider.complete('prompt', { temperature: 0.2, maxTokens: 1024 });

    expect(mockedAxios.post).toHaveBeenCalledWith('http://localhost:9999/v1/messages', expect.anything(), expect.anything());
  });
});
