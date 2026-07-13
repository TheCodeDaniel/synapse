import axios from 'axios';
import * as path from 'path';
import { Pipeline } from '../index';
import { LLMProvider } from '../../agent/providers';
import { CoreConfig, CoreEvent, ok } from '../../types';
import figmaFixture from '../../compiler/__tests__/fixtures/figma-file-response.json';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

const FLUTTER_FIXTURE = path.join(__dirname, '..', '..', 'analyzer', '__tests__', 'fixtures', 'clean-arch-setstate-project');

function buildConfig(overrides: Partial<CoreConfig> = {}): CoreConfig {
  return {
    projectName: 'demo',
    figma: { accessToken: 'token', apiBaseUrl: 'https://api.figma.com/v1', cacheEnabled: false, cacheTTLMinutes: 60 },
    flutter: { projectPath: FLUTTER_FIXTURE, analyzerTimeoutMs: 30000, incrementalAnalysis: true },
    ai: { provider: 'anthropic', apiKey: 'k', model: 'claude-x', temperature: 0.2, maxTokens: 1024 },
    storage: { type: 'memory' },
    logging: { level: 'error', toConsole: false, toFile: false },
    ...overrides,
  };
}

describe('Pipeline', () => {
  beforeEach(() => {
    mockedAxios.create.mockReturnValue({
      get: jest.fn((url: string) => {
        if (url.includes('/variables/local')) return Promise.resolve({ data: { variableCollections: {}, variables: {} } });
        return Promise.resolve({ data: figmaFixture });
      }),
    } as any);
  });

  it('threads state from importFigmaFile -> analyzeProject -> generatePlan -> generateUI', async () => {
    const fakeProvider: LLMProvider = { complete: jest.fn().mockResolvedValue(ok('class Generated extends StatelessWidget {}')) };
    const pipeline = new Pipeline(buildConfig(), { llmProvider: fakeProvider });

    const designGraph = await pipeline.importFigmaFile('fixture-key');
    expect(designGraph.pages).toHaveLength(1);

    const projectGraph = await pipeline.analyzeProject();
    expect(projectGraph.architecture.pattern).toBe('clean_architecture');

    const plan = await pipeline.generatePlan();
    expect(plan.tasks.length).toBeGreaterThan(0);

    const results = await pipeline.generateUI();
    expect(results.length).toBe(plan.tasks.length);
    expect(results.every(r => r.success)).toBe(true);
  });

  it('emits progress and per-step CoreEvents', async () => {
    const pipeline = new Pipeline(buildConfig());
    const events: CoreEvent[] = [];
    pipeline.on(e => events.push(e));

    await pipeline.importFigmaFile('fixture-key');

    expect(events.some(e => e.type === 'progress')).toBe(true);
    expect(events.some(e => e.type === 'design.compiled')).toBe(true);
  });

  it('refuses to generate a plan before importing/analyzing', async () => {
    const pipeline = new Pipeline(buildConfig());

    await expect(pipeline.generatePlan()).rejects.toThrow(/Import a Figma file/);
  });

  it('refuses to generate UI before a plan exists', async () => {
    const pipeline = new Pipeline(buildConfig());

    await expect(pipeline.generateUI()).rejects.toThrow(/Generate an implementation plan/);
  });

  it('validateCode emits a validation.completed event', () => {
    const pipeline = new Pipeline(buildConfig());
    const events: CoreEvent[] = [];
    pipeline.on(e => events.push(e));

    pipeline.validateCode();

    expect(events.some(e => e.type === 'validation.completed')).toBe(true);
  });
});
