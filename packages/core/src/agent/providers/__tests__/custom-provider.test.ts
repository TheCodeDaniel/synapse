import axios from 'axios';
import { CustomProvider } from '../custom-provider';
import { AIConfig } from '../../../types';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

function buildConfig(overrides: Partial<AIConfig> = {}): AIConfig {
  return { provider: 'custom', apiKey: 'test-key', model: 'qwen2.5-coder', temperature: 0.2, maxTokens: 1024, baseUrl: 'http://localhost:8000/v1', ...overrides };
}

describe('CustomProvider', () => {
  it('calls the configured baseUrl with an OpenAI-compatible request', async () => {
    mockedAxios.post.mockResolvedValueOnce({ data: { choices: [{ message: { content: 'class Foo {}' } }] } });
    const provider = new CustomProvider(buildConfig());

    const result = await provider.complete('prompt', { temperature: 0.2, maxTokens: 1024 });

    expect(result.ok).toBe(true);
    expect(mockedAxios.post).toHaveBeenCalledWith(
      'http://localhost:8000/v1/chat/completions',
      expect.objectContaining({ model: 'qwen2.5-coder' }),
      expect.anything()
    );
  });

  it('errors without hitting the network when baseUrl is missing', async () => {
    const provider = new CustomProvider(buildConfig({ baseUrl: undefined }));

    const result = await provider.complete('prompt', { temperature: 0.2, maxTokens: 1024 });

    expect(result.ok).toBe(false);
    expect(mockedAxios.post).not.toHaveBeenCalled();
  });
});
