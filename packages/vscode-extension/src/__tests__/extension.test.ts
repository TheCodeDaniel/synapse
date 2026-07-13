import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

jest.mock('@design-intelligence/core', () => {
  const actual = jest.requireActual('@design-intelligence/core');
  return {
    ...actual,
    createLogger: jest.fn(() => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() })),
    loadOrCreateConfig: jest.fn(),
    Pipeline: jest.fn(),
  };
});

import * as vscodeMock from 'vscode';
import * as core from '@design-intelligence/core';
import { activate } from '../extension';

const COMMAND_IDS = [
  'di.reload',
  'design-intelligence.setFigmaToken',
  'design-intelligence.setAiApiKey',
  'design-intelligence.importFigmaFile',
  'design-intelligence.analyzeProject',
  'design-intelligence.generatePlan',
  'design-intelligence.generateUI',
  'design-intelligence.validateCode',
  'design-intelligence.syncChanges',
];

function fakeContext(): any {
  return {
    subscriptions: [],
    secrets: {
      get: jest.fn().mockResolvedValue('fake-secret'),
      store: jest.fn().mockResolvedValue(undefined),
    },
  };
}

function fakeWorkspaceFolder(projectPath: string) {
  return { uri: (vscodeMock as any).Uri.file(projectPath), name: 'project', index: 0 };
}

/**
 * `activate()` re-registers commands every call, but the module-level
 * `pipeline`/`currentConfig` singleton in extension.ts is NOT reset by
 * `activate()` itself — only by the `di.reload` command. Without invoking
 * that between tests, a Pipeline created by one test would leak into the
 * next (they all use the same fake `projectName`), since `getPipeline()`
 * reuses an existing instance for the same project name.
 */
function activateFresh(context: any): void {
  activate(context);
  (vscodeMock as any).__registeredCommands.get('di.reload')();
}

function fakeDesignGraph() {
  return {
    id: 'g1',
    version: '1.0.0',
    figmaFileKey: 'k',
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
      folders: {
        lib: '',
        features: {},
        shared: { widgets: '', themes: '', utils: '', constants: '', services: '', models: '', routes: '', localization: '' },
        assets: '',
        locales: '',
        config: '',
      },
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
    state: {},
    on: jest.fn(() => jest.fn()),
    importFigmaFile: jest.fn().mockResolvedValue(fakeDesignGraph()),
    analyzeProject: jest.fn().mockResolvedValue(fakeProjectGraph()),
    generatePlan: jest.fn().mockResolvedValue({
      id: 'plan1',
      tasks: [],
      summary: { widgetsToReuse: 1, widgetsToUpdate: 2, widgetsToCreate: 3 },
    }),
    generateUI: jest.fn().mockResolvedValue([{ taskId: 't1', filePath: 'lib/widgets/x.dart', success: true, content: 'class X {}' }]),
    integrateFiles: jest.fn().mockResolvedValue({ filesModified: 0, filesCreated: 1, routesUpdated: [], errors: [] }),
    validateCode: jest.fn().mockReturnValue({ passed: true, errors: [], warnings: [], output: '' }),
    syncChanges: jest.fn().mockResolvedValue([]),
    ...overrides,
  };
}

describe('extension.ts command registration', () => {
  let tmpDir: string;

  beforeEach(() => {
    (vscodeMock as any).__reset();
    (core.loadOrCreateConfig as jest.Mock).mockReset();
    (core.Pipeline as unknown as jest.Mock).mockReset();

    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'di-ext-test-'));
    (vscodeMock as any).workspace.workspaceFolders = undefined;
    (vscodeMock as any).workspace.getConfiguration = jest.fn(() => ({ get: jest.fn(() => undefined) }));
    (vscodeMock as any).window.showInputBox = jest.fn().mockResolvedValue(undefined);
    (vscodeMock as any).window.showWarningMessage = jest.fn().mockResolvedValue(undefined);

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

  it('registers all 9 commands on activate', () => {
    activateFresh(fakeContext());

    for (const id of COMMAND_IDS) {
      expect((vscodeMock as any).__registeredCommands.has(id)).toBe(true);
    }
  });

  it('importFigmaFile shows an error and does not call the Pipeline when no workspace folder is open', async () => {
    activateFresh(fakeContext());
    const handler = (vscodeMock as any).__registeredCommands.get('design-intelligence.importFigmaFile');

    await handler();

    expect((vscodeMock as any).__shownMessages.some((m: any) => m.kind === 'error' && /no workspace folder/i.test(m.message))).toBe(true);
    expect(core.Pipeline).not.toHaveBeenCalled();
  });

  it('importFigmaFile prompts to set a token when no Figma access token is configured', async () => {
    (vscodeMock as any).workspace.workspaceFolders = [fakeWorkspaceFolder(tmpDir)];
    (vscodeMock as any).window.showInputBox = jest.fn().mockResolvedValue('https://www.figma.com/file/ABC123/Test');
    const context = fakeContext();
    context.secrets.get.mockResolvedValue(undefined); // no stored token

    activateFresh(context);
    const handler = (vscodeMock as any).__registeredCommands.get('design-intelligence.importFigmaFile');
    await handler();

    expect((vscodeMock as any).__shownMessages.some((m: any) => /no figma access token/i.test(m.message))).toBe(true);
    expect(core.Pipeline).not.toHaveBeenCalled();
  });

  it('importFigmaFile calls Pipeline.importFigmaFile with the extracted file key when configured', async () => {
    (vscodeMock as any).workspace.workspaceFolders = [fakeWorkspaceFolder(tmpDir)];
    (vscodeMock as any).window.showInputBox = jest.fn().mockResolvedValue('https://www.figma.com/file/ABC123/Test');
    const fakePipeline = fakePipelineInstance();
    (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);

    const context = fakeContext();
    context.secrets.get.mockResolvedValue('a-real-token');
    activateFresh(context);

    const handler = (vscodeMock as any).__registeredCommands.get('design-intelligence.importFigmaFile');
    await handler();

    expect(fakePipeline.importFigmaFile).toHaveBeenCalledWith('ABC123');
    expect((vscodeMock as any).__shownMessages.some((m: any) => m.kind === 'info' && /Imported/.test(m.message))).toBe(true);
  });

  it('analyzeProject calls Pipeline.analyzeProject and reports the result', async () => {
    (vscodeMock as any).workspace.workspaceFolders = [fakeWorkspaceFolder(tmpDir)];
    const fakePipeline = fakePipelineInstance();
    (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);

    activateFresh(fakeContext());
    const handler = (vscodeMock as any).__registeredCommands.get('design-intelligence.analyzeProject');
    await handler();

    expect(fakePipeline.analyzeProject).toHaveBeenCalled();
    expect((vscodeMock as any).__shownMessages.some((m: any) => /Analyzed project/.test(m.message))).toBe(true);
  });

  it('generatePlan surfaces a clear error when called before import/analyze', async () => {
    (vscodeMock as any).workspace.workspaceFolders = [fakeWorkspaceFolder(tmpDir)];
    const fakePipeline = fakePipelineInstance({
      generatePlan: jest.fn().mockRejectedValue(new Error('Import a Figma file before generating a plan.')),
    });
    (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);

    activateFresh(fakeContext());
    const handler = (vscodeMock as any).__registeredCommands.get('design-intelligence.generatePlan');
    await handler();

    expect((vscodeMock as any).__shownMessages.some((m: any) => m.kind === 'error' && /Import a Figma file/.test(m.message))).toBe(true);
  });

  it('generateUI asks for confirmation before writing files and skips generation if declined', async () => {
    (vscodeMock as any).workspace.workspaceFolders = [fakeWorkspaceFolder(tmpDir)];
    (vscodeMock as any).window.showWarningMessage = jest.fn().mockResolvedValue(undefined); // user dismisses the confirmation
    const fakePipeline = fakePipelineInstance();
    (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);

    const context = fakeContext();
    context.secrets.get.mockResolvedValue('a-real-key');
    activateFresh(context);

    const handler = (vscodeMock as any).__registeredCommands.get('design-intelligence.generateUI');
    await handler();

    expect(fakePipeline.generateUI).not.toHaveBeenCalled();
  });

  it('generateUI generates and integrates files when confirmed', async () => {
    (vscodeMock as any).workspace.workspaceFolders = [fakeWorkspaceFolder(tmpDir)];
    (vscodeMock as any).window.showWarningMessage = jest.fn().mockResolvedValue('Generate');
    const fakePipeline = fakePipelineInstance();
    (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);

    const context = fakeContext();
    context.secrets.get.mockResolvedValue('a-real-key');
    activateFresh(context);

    const handler = (vscodeMock as any).__registeredCommands.get('design-intelligence.generateUI');
    await handler();

    expect(fakePipeline.generateUI).toHaveBeenCalled();
    expect(fakePipeline.integrateFiles).toHaveBeenCalledWith([{ filePath: 'lib/widgets/x.dart', content: 'class X {}' }]);
  });

  it('validateCode reports a passing result', async () => {
    (vscodeMock as any).workspace.workspaceFolders = [fakeWorkspaceFolder(tmpDir)];
    const fakePipeline = fakePipelineInstance();
    (core.Pipeline as unknown as jest.Mock).mockImplementation(() => fakePipeline);

    activateFresh(fakeContext());
    const handler = (vscodeMock as any).__registeredCommands.get('design-intelligence.validateCode');
    await handler();

    expect(fakePipeline.validateCode).toHaveBeenCalled();
    expect((vscodeMock as any).__shownMessages.some((m: any) => /Validation passed/.test(m.message))).toBe(true);
  });

  it('setFigmaToken stores the entered token via context.secrets', async () => {
    (vscodeMock as any).window.showInputBox = jest.fn().mockResolvedValue('my-figma-token');
    const context = fakeContext();
    activateFresh(context);

    const handler = (vscodeMock as any).__registeredCommands.get('design-intelligence.setFigmaToken');
    await handler();

    expect(context.secrets.store).toHaveBeenCalledWith(expect.stringContaining('figma'), 'my-figma-token');
  });
});
