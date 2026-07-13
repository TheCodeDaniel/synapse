import axios from 'axios';
import { FigmaClient } from '../figma-client';
import { Logger } from '../../utils/logger';
import fixture from './fixtures/figma-file-response.json';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

function createLogger(): Logger {
  return new Logger({ level: 'debug', toConsole: false, toFile: false });
}

describe('FigmaClient', () => {
  let getMock: jest.Mock;

  beforeEach(() => {
    getMock = jest.fn();
    mockedAxios.create.mockReturnValue({ get: getMock } as any);
    mockedAxios.isAxiosError.mockImplementation((e: any) => !!e?.isAxiosError);
  });

  it('parses the real Figma file response shape (document at the top level, not nested under `doc`)', async () => {
    getMock.mockResolvedValueOnce({ data: fixture });
    const client = new FigmaClient('test-token', null, createLogger());

    const result = await client.getFile('abc123');

    expect(getMock).toHaveBeenCalledWith('/files/abc123');
    expect(result.document.type).toBe('DOCUMENT');
    expect(result.document.children).toHaveLength(1);
    expect(result.document.children[0].children[0].name).toBe('Screen');
  });

  it.each(['getComponents', 'getVariables', 'getImage'] as const)(
    'does not leak the Figma access token when %s fails',
    async method => {
      const accessToken = 'super-secret-figma-token';
      const axiosError = {
        isAxiosError: true,
        message: 'Request failed with status code 401',
        response: { data: { message: 'Invalid token' } },
        config: { headers: { 'X-Figma-Token': accessToken } },
      };
      getMock.mockRejectedValueOnce(axiosError);

      const logger = createLogger();
      const errorSpy = jest.spyOn(logger, 'error');
      const client = new FigmaClient(accessToken, null, logger);

      if (method === 'getComponents') await client.getComponents('abc123', ['1:1']);
      else if (method === 'getVariables') await client.getVariables('abc123');
      else await client.getImage('abc123', '1:1').catch(() => undefined);

      expect(errorSpy).toHaveBeenCalled();
      for (const call of errorSpy.mock.calls) {
        expect(JSON.stringify(call)).not.toContain(accessToken);
      }
    }
  );
});
