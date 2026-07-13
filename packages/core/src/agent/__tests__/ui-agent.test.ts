import { UIAgent } from '../index';
import { LLMProvider } from '../providers';
import { AIConfig, DesignGraph, ProjectGraph, Task, ok, err, createError, ErrorCode } from '../../types';

function buildTask(overrides: Partial<Task> = {}): Task {
  return {
    id: 't1',
    type: 'create_widget',
    priority: 'high',
    order: 0,
    title: 'Build primary button',
    description: 'Create a primary button widget matching the design.',
    targetFilePath: 'lib/widgets/primary_button.dart',
    requiresManualReview: false,
    dependencies: [],
    status: 'pending',
    ...overrides,
  };
}

function buildDesignGraph(): DesignGraph {
  return {
    id: 'g1',
    version: '1.0.0',
    figmaFileKey: 'k',
    fileName: 'f',
    importedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pages: [],
    components: new Map(),
    variables: { colors: new Map(), scalars: new Map(), strings: new Map(), boolean: new Map(), composite: new Map() },
    designTokens: { colors: [], spacing: [], typography: [], breakpoints: [], shadows: [], borders: [], opacity: [], radii: [], zIndices: [] },
    assets: { images: new Map(), svgs: new Map(), others: new Map() },
  };
}

function buildProjectGraph(): ProjectGraph {
  return {
    widgets: new Map(),
    themes: { colors: new Map(), textStyles: new Map(), breakpoints: [], spacing: [], shadows: [], borders: [], radii: [] },
  } as unknown as ProjectGraph;
}

function buildConfig(overrides: Partial<AIConfig> = {}): AIConfig {
  return { provider: 'anthropic', apiKey: 'k', model: 'claude-x', temperature: 0.2, maxTokens: 1024, ...overrides };
}

describe('UIAgent', () => {
  it('builds a prompt and returns generated content on success', async () => {
    const fakeProvider: LLMProvider = { complete: jest.fn().mockResolvedValue(ok('class PrimaryButton extends StatelessWidget {}')) };
    const agent = new UIAgent(buildConfig(), fakeProvider);

    const result = await agent.generate(buildTask(), buildDesignGraph(), buildProjectGraph(), {} as any);

    expect(result.success).toBe(true);
    expect(result.content).toBe('class PrimaryButton extends StatelessWidget {}');
    expect(fakeProvider.complete).toHaveBeenCalledWith(
      expect.stringContaining('Build primary button'),
      { temperature: 0.2, maxTokens: 1024 }
    );
  });

  it('surfaces a provider Result error as a failed GenerationResult instead of throwing', async () => {
    const fakeProvider: LLMProvider = {
      complete: jest.fn().mockResolvedValue(err(createError(ErrorCode.MISSING_API_KEY, 'Anthropic API key is not configured'))),
    };
    const agent = new UIAgent(buildConfig({ apiKey: '' }), fakeProvider);

    const result = await agent.generate(buildTask(), buildDesignGraph(), buildProjectGraph(), {} as any);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Anthropic API key is not configured');
  });

  it('generateBatch runs every task through the provider', async () => {
    const fakeProvider: LLMProvider = { complete: jest.fn().mockResolvedValue(ok('// generated')) };
    const agent = new UIAgent(buildConfig(), fakeProvider);
    const tasks = [buildTask({ id: 't1' }), buildTask({ id: 't2' })];

    const results = await agent.generateBatch(tasks, buildDesignGraph(), buildProjectGraph(), {} as any);

    expect(results).toHaveLength(2);
    expect(results.every(r => r.success)).toBe(true);
    expect(fakeProvider.complete).toHaveBeenCalledTimes(2);
  });
});
