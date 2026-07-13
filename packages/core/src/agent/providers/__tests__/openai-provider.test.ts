import axios from 'axios';
import { OpenAIProvider } from '../openai-provider';
import { AIConfig } from '../../../types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function buildConfig(overrides: Partial<AIConfig> = {}): AIConfig {
  return { provider: 'openai', apiKey: 'test-key', model: 'gpt-4o', temperature: 0.2, maxTokens: 1024, ...overrides };
}

describe('OpenAIProvider', () => {
  it('returns the message content on success', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { choices: [{ message: { content: 'class Foo {}' } }] } });
    const provider = new OpenAIProvider(buildConfig());

    const result = await provider.complete('prompt', { temperature: 0.2, maxTokens: 1024 });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value).toBe('class Foo {}');
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'https://api.openai.com/v1/chat/completions',
      expect.objectContaining({ model: 'gpt-4o' }),
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: 'Bearer test-key' }) })
    );
  });

  it('returns a Result error when no API key is configured', async () => {
    const provider = new OpenAIProvider(buildConfig({ apiKey: '' }));

    const result = await provider.complete('prompt', { temperature: 0.2, maxTokens: 1024 });

    expect(result.ok).toBe(false);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });

  it('returns a Result error for a malformed response instead of throwing', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: {} });
    const provider = new OpenAIProvider(buildConfig());

    const result = await provider.complete('prompt', { temperature: 0.2, maxTokens: 1024 });

    expect(result.ok).toBe(false);
  });
});
