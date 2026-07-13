import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('@design-intelligence/core', () => {
  const actual = jest.requireActual('@design-intelligence/core');
  return {
    ...actual,
    loadOrCreateConfig: jest.fn(),
    Pipeline: jest.fn(),
  };
});

import * as vscode from 'vscode';
import * as core from '@design-intelligence/core';
import * as actions from '../actions';

function fakeLogger(): any {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
}

function fakeContext(secrets: Record<string, string> = {}): any {
  return {
    secrets: {
      get: jest.fn(async (key: string) => secrets[key]),
      store: jest.fn(async (key: string, value: string) => {
        secrets[key] = value;
      }),
    },
  };
}

function fakeFolder(fsPath: string): any {
  return { uri: { fsPath }, name: path.basename(fsPath), index: 0 };
}

function fakeDesignGraph() {
  return {
    id: 'g1',
    version: '1.0.0',
    figmaFileKey: 'ABC123',
    fileName: 'Test File',
    importedAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    pages: [{ id: 'p1', name: 'Page 1', type: 'page', order: 0, children: [] }],
    components: new Map(),
    variables: { colors: new Map(), scalars: new Map(), strings: new Map(), boolean: new Map(), composite: new Map() },
    designTokens: { colors: [], spacing: [], typography: [], breakpoints: [], shadows: [], borders: [], opacity: [], radii: [], zIndices: [] },
    assets: { images: new Map(), svgs: new Map(), others: new Map() },
  };
}

function fakeProjectGraph() {
  return {
    id: 'pg1',
    version: '1.0.0',
    projectName: 'demo',
    flutterSdkVersion: '',
    dartSdkVersion: '',
    analyzedAt: '2026-01-01T00:00:00.000Z',
    rootPath: '',
    architecture: {
      pattern: 'clean_architecture',
      folders: { lib: '', features: {}, shared: { widgets: '', themes: '', utils: '', constants: '', services: '', models: '', routes: '', localization: '' }, assets: '', locales: '', config: '' },
      hasTestFolder: false,
      hasIntegrationTest: false,
    },
    widgets: new Map(),
    themes: { colors: new Map(), textStyles: new Map(), breakpoints: [], spacing: [], shadows: [], borders: [], radii: [] },
    routing: { hasGoRouter: false, routesFilePath: '', routeDefinitions: [], hasTransitionAnimation: false },
    localization: { hasIntl: false, supportedLocales: [], arrowKeysHandling: false, pluralization: false, rtlSupport: false },
    models: new Map(),
    services: new Map(),
    repositories: new Map(),
    dependencies: { pubspecPath: '', dependencies: {}, devDependencies: {}, flutterSdk: '', keyPackages: [] },
    assets: { images: [], fonts: [], locales: [], others: [] },
    conventions: {
      namingConvention: { files: 'camelCase', classes: 'PascalCase', variables: 'camelCase', constants: 'UPPER_SNAKE_CASE', methods: 'camelCase', folders: 'camelCase' },
      importOrdering: { dartCoreFirst: true, flutterFirst: true, thirdPartyAfterFlutter: true, localImportsLast: true, grouped: true },
      fileStructure: { singleWidgetPerFile: true, partFiles: false, barrelExports: false, indexFiles: false },
      codeStyle: { trailingCommas: true, nullSafety: true, explicitReturnTypes: false, constConstructors: true, preferConstConstructor: true },
    },
  };
}

function fakePipelineInstance(overrides: Partial<Record<string, jest.Mock>> = {}) {
  return {
    state: {} as { designGraph?: unknown; projectGraph?: unknown; plan?: unknown },
    on: jest.fn(() => jest.fn()),
    importFigmaFile: jest.fn().mockResolvedValue(fakeDesignGraph()),
    analyzeProject: jest.fn().mockResolvedValue(fakeProjectGraph()),
    generatePlan: jest.fn().mockResolvedValue({ id: 'plan1', tasks: [], summary: { widgetsToReuse: 1, widgetsToUpdate: 2, widgetsToCreate: 3 } }),
    generateUI: jest.fn().mockResolvedValue([{ taskId: 't1', filePath: 'lib/widgets/x.dart', success: true, content: 'class X {}' }]),
    integrateFiles: jest.fn().mockResolvedValue({ filesModified: 0, filesCreated: 1, routesUpdated: [], errors: [] }),
    validateCode: jest.fn().mockReturnValue({ passed: true, errors: [], warnings: [], output: '' }),
    syncChanges: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

const FIGMA_URL = 'https://www.figma.com/design/ABC123/Test';

describe('actions', () => {
  let tmpDir: string;

  beforeEach(() => {
    actions.resetState();
    (core.loadOrCreateConfig as jest.Mock).mockReset();
    (core.Pipeline as unknown as jest.Mock).mockReset();

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'di-actions-'));
    (core.loadOrCreateConfig as jest.Mock).mockReturnValue({
      projectName: 'demo',
      figma: { accessToken: '', apiBaseUrl: 'https://api.figma.com/v1', cacheEnabled: false, cacheTTLMinutes: 60 },
      flutter: { projectPath: '', analyzerTimeoutMs: 30000, incrementalAnalysis: true },
      ai: { provider: 'anthropic', apiKey: '', model: 'claude-x', temperature: 0.2, maxTokens: 1024 },
      storage: { type: 'filesystem', path: tmpDir },
      logging: { level: 'error', toConsole: false, toFile: false },
    });
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  describe('setFigmaToken / setAiApiKey', () => {
    it('stores the token/key via context.secrets', async () => {
      const context = fakeContext();
      const tokenResult = await actions.setFigmaToken(context, 'my-token');
      const keyResult = await actions.setAiApiKey(context, 'my-key');

      expect(tokenResult.ok).toBe(true);
      expect(keyResult.ok).toBe(true);
      expect(context.secrets.store).toHaveBeenCalledWith(expect.stringContaining('figma'), 'my-token');
      expect(context.secrets.store).toHaveBeenCalledWith(expect.stringContaining('ai'), 'my-key');
    });
  });

  describe('importFigmaFile', () => {
    it('rejects a non-Figma URL without touching the Pipeline', async () => {
      const context = fakeContext({ 'designIntelligence.figmaAccessToken': 'tok' });

      const result = await actions.importFigmaFile(context, fakeFolder(tmpDir), 'https://example.com', fakeLogger());

      expect(result.ok).toBe(false);
      expect(core.Pipeline).not.toHaveBeenCalled();
    });

    it('rejects a Figma URL with no extractable file key', async () => {
      const context = fakeContext({ 'designIntelligence.figmaAccessToken': 'tok' });

      const result = await actions.importFigmaFile(context, fakeFolder(tmpDir), 'https://www.figma.com/community', fakeLogger());

      expect(result.ok).toBe(false);
    });

    it('rejects when no Figma token is configured', async () => {
      const context = fakeContext();

      const result = await actions.importFigmaFile(context, fakeFolder(tmpDir), FIGMA_URL, fakeLogger());

      expect(result.ok).toBe(false);
      expect(result.message).toMatch(/token/i);
    });

    it('imports, persists the design graph, and streams progress', async () => {
      const fakePipeline = fakePipelineInstance();
      (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);
      const context = fakeContext({ 'designIntelligence.figmaAccessToken': 'tok' });
      const progressUpdates: Array<[string, number]> = [];

      const result = await actions.importFigmaFile(context, fakeFolder(tmpDir), FIGMA_URL, fakeLogger(), (m, p) => progressUpdates.push([m, p]));

      expect(result.ok).toBe(true);
      expect(fakePipeline.importFigmaFile).toHaveBeenCalledWith('ABC123');
      expect(fs.existsSync(path.join(tmpDir, 'design-graph.json'))).toBe(true);
    });

    it('returns ok:false when the Pipeline throws, instead of throwing itself', async () => {
      const fakePipeline = fakePipelineInstance({ importFigmaFile: jest.fn().mockRejectedValue(new Error('network down')) });
      (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);
      const context = fakeContext({ 'designIntelligence.figmaAccessToken': 'tok' });

      const result = await actions.importFigmaFile(context, fakeFolder(tmpDir), FIGMA_URL, fakeLogger());

      expect(result.ok).toBe(false);
      expect(result.message).toContain('network down');
    });
  });

  describe('analyzeProject', () => {
    it('analyzes and persists the project graph', async () => {
      const fakePipeline = fakePipelineInstance();
      (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);
      const context = fakeContext();

      const result = await actions.analyzeProject(context, fakeFolder(tmpDir), fakeLogger());

      expect(result.ok).toBe(true);
      expect(result.message).toContain('clean_architecture');
      expect(fs.existsSync(path.join(tmpDir, 'project-graph.json'))).toBe(true);
    });
  });

  describe('generatePlan', () => {
    it('requires designGraph/projectGraph in Pipeline state (surfaces the Pipeline error, does not swallow it)', async () => {
      const fakePipeline = fakePipelineInstance({
        generatePlan: jest.fn().mockRejectedValue(new Error('Import a Figma file before generating a plan.')),
      });
      (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);
      const context = fakeContext();

      const result = await actions.generatePlan(context, fakeFolder(tmpDir), fakeLogger());

      expect(result.ok).toBe(false);
      expect(result.message).toContain('Import a Figma file');
    });

    it('returns the plan summary on success', async () => {
      const fakePipeline = fakePipelineInstance();
      (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);
      const context = fakeContext();

      const result = await actions.generatePlan(context, fakeFolder(tmpDir), fakeLogger());

      expect(result.ok).toBe(true);
      expect(result.data?.summary.widgetsToCreate).toBe(3);
    });
  });

  describe('generateUI', () => {
    it('rejects when no AI API key is configured, without calling the Pipeline', async () => {
      const context = fakeContext();

      const result = await actions.generateUI(context, fakeFolder(tmpDir), fakeLogger());

      expect(result.ok).toBe(false);
      expect(core.Pipeline).not.toHaveBeenCalled();
    });

    it('generates and integrates files when configured', async () => {
      const fakePipeline = fakePipelineInstance();
      (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);
      const context = fakeContext({ 'designIntelligence.aiApiKey': 'key' });

      const result = await actions.generateUI(context, fakeFolder(tmpDir), fakeLogger());

      expect(result.ok).toBe(true);
      expect(fakePipeline.generateUI).toHaveBeenCalled();
      expect(fakePipeline.integrateFiles).toHaveBeenCalledWith([{ filePath: 'lib/widgets/x.dart', content: 'class X {}' }]);
    });

    it('does not itself ask for confirmation — callers decide before invoking', async () => {
      const fakePipeline = fakePipelineInstance();
      (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);
      const context = fakeContext({ 'designIntelligence.aiApiKey': 'key' });

      await actions.generateUI(context, fakeFolder(tmpDir), fakeLogger());

      expect(fakePipeline.generateUI).toHaveBeenCalledTimes(1);
    });
  });

  describe('validateCode', () => {
    it('reports ok:true when validation passes', async () => {
      const fakePipeline = fakePipelineInstance();
      (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);
      const context = fakeContext();

      const result = await actions.validateCode(context, fakeFolder(tmpDir), fakeLogger());

      expect(result.ok).toBe(true);
    });

    it('reports ok:false with the real ValidationResult when validation fails', async () => {
      const fakePipeline = fakePipelineInstance({
        validateCode: jest.fn().mockReturnValue({
          passed: false,
          errors: [{ file: 'lib/main.dart', line: 2, column: 9, message: "Undefined name 'x'", severity: 'error' }],
          warnings: [],
          output: '',
        }),
      });
      (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);
      const context = fakeContext();

      const result = await actions.validateCode(context, fakeFolder(tmpDir), fakeLogger());

      expect(result.ok).toBe(false);
      expect(result.data?.errors).toHaveLength(1);
    });
  });

  describe('populateDiagnostics', () => {
    it('converts ValidationError entries into VS Code diagnostics keyed by file', () => {
      const collection = (vscode.languages.createDiagnosticCollection as jest.Mock)();
      const folder = fakeFolder(tmpDir);
      const result = {
        passed: false,
        errors: [{ file: 'lib/main.dart', line: 2, column: 9, message: "Undefined name 'x'", severity: 'error' as const }],
        warnings: [],
        output: '',
      };

      actions.populateDiagnostics(collection, folder, result);

      expect(collection.set).toHaveBeenCalledWith(
        vscode.Uri.file(path.join(tmpDir, 'lib/main.dart')),
        [expect.objectContaining({ message: "Undefined name 'x'" })]
      );
    });
  });

  describe('syncChanges', () => {
    it('returns the relevant task ids from the Pipeline', async () => {
      const fakePipeline = fakePipelineInstance({ syncChanges: jest.fn().mockResolvedValue(['t1', 't2']) });
      (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);
      const context = fakeContext();

      const result = await actions.syncChanges(context, fakeFolder(tmpDir), fakeLogger());

      expect(result.ok).toBe(true);
      expect(result.data).toEqual(['t1', 't2']);
    });
  });

  describe('getStatus', () => {
    it('reports credential status without a workspace folder', async () => {
      const context = fakeContext({ 'designIntelligence.figmaAccessToken': 'tok' });

      const status = await actions.getStatus(context, undefined, fakeLogger());

      expect(status.hasFigmaToken).toBe(true);
      expect(status.hasAiApiKey).toBe(false);
      expect(status.designGraph).toBeUndefined();
    });

    it('reflects imported/analyzed state once actions have run in this session', async () => {
      const fakePipeline = fakePipelineInstance();
      fakePipeline.importFigmaFile.mockImplementation(async () => {
        const graph = fakeDesignGraph();
        fakePipeline.state.designGraph = graph;
        return graph;
      });
      (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);
      const context = fakeContext({ 'designIntelligence.figmaAccessToken': 'tok' });
      const folder = fakeFolder(tmpDir);

      await actions.importFigmaFile(context, folder, FIGMA_URL, fakeLogger());
      const status = await actions.getStatus(context, folder, fakeLogger());

      expect(status.designGraph).toEqual({ fileName: 'Test File', pageCount: 1, componentCount: 0 });
    });
  });
});
