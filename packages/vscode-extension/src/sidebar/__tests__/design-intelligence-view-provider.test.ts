jest.mock('../../actions');

import * as vscode from 'vscode';
import * as actions from '../../actions';
import { DesignIntelligenceViewProvider } from '../design-intelligence-view-provider';

function fakeLogger(): any {
  return { info: jest.fn(), warn: jest.fn(), error: jest.fn(), debug: jest.fn() };
}

function fakeWebviewView() {
  let messageHandler: ((message: unknown) => void) | undefined;
  const webview = {
    options: {},
    html: '',
    postMessage: jest.fn(),
    onDidReceiveMessage: jest.fn((handler: (message: unknown) => void) => {
      messageHandler = handler;
      return { dispose: jest.fn() };
    }),
  };
  return {
    webview,
    send: (message: unknown) => messageHandler?.(message),
  };
}

describe('DesignIntelligenceViewProvider', () => {
  let context: any;
  let diagnostics: any;
  let provider: DesignIntelligenceViewProvider;

  beforeEach(() => {
    jest.clearAllMocks();
    context = { secrets: { get: jest.fn(), store: jest.fn() } };
    diagnostics = { clear: jest.fn(), set: jest.fn() };
    (vscode as any).workspace.workspaceFolders = [{ uri: { fsPath: '/tmp/project' }, name: 'project', index: 0 }];
    (actions.getStatus as jest.Mock).mockResolvedValue({ hasFigmaToken: false, hasAiApiKey: false });
    provider = new DesignIntelligenceViewProvider(context, fakeLogger(), diagnostics);
  });

  it('sets webview options/html and pushes initial state on resolve', async () => {
    const view = fakeWebviewView();

    provider.resolveWebviewView(view as any);
    await Promise.resolve(); // let the async pushStatus() settle

    expect(view.webview.options).toEqual({ enableScripts: true });
    expect(view.webview.html).toContain('<!DOCTYPE html>');
    expect(view.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'state' }));
  });

  it('requestState re-pushes the current status', async () => {
    const view = fakeWebviewView();
    provider.resolveWebviewView(view as any);
    await Promise.resolve();
    view.webview.postMessage.mockClear();

    await view.send({ type: 'requestState' });

    expect(actions.getStatus).toHaveBeenCalled();
    expect(view.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'state' }));
  });

  it('setFigmaToken delegates to actions.setFigmaToken and posts the result', async () => {
    (actions.setFigmaToken as jest.Mock).mockResolvedValue({ ok: true, message: 'saved' });
    const view = fakeWebviewView();
    provider.resolveWebviewView(view as any);
    await Promise.resolve();

    await view.send({ type: 'setFigmaToken', token: 'abc' });

    expect(actions.setFigmaToken).toHaveBeenCalledWith(context, 'abc');
    expect(view.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'result', command: 'setFigmaToken', ok: true, message: 'saved' }));
  });

  it('importFigmaFile forwards progress updates as postMessage calls', async () => {
    (actions.importFigmaFile as jest.Mock).mockImplementation(async (_ctx, _folder, _url, _logger, onProgress) => {
      onProgress?.('Fetching...', 50);
      return { ok: true, message: 'imported' };
    });
    const view = fakeWebviewView();
    provider.resolveWebviewView(view as any);
    await Promise.resolve();

    await view.send({ type: 'importFigmaFile', url: 'https://www.figma.com/design/ABC/Test' });

    expect(view.webview.postMessage).toHaveBeenCalledWith({ type: 'progress', message: 'Fetching...', percentage: 50 });
    expect(view.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ type: 'result', command: 'importFigmaFile', ok: true }));
  });

  it('reports an error instead of calling actions when no workspace folder is open', async () => {
    (vscode as any).workspace.workspaceFolders = undefined;
    const view = fakeWebviewView();
    provider.resolveWebviewView(view as any);
    await Promise.resolve();

    await view.send({ type: 'analyzeProject' });

    expect(actions.analyzeProject).not.toHaveBeenCalled();
    expect(view.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ ok: false, message: expect.stringContaining('No workspace folder') }));
  });

  it('generateUI refuses to call actions.generateUI when not confirmed', async () => {
    const view = fakeWebviewView();
    provider.resolveWebviewView(view as any);
    await Promise.resolve();

    await view.send({ type: 'generateUI', confirmed: false });

    expect(actions.generateUI).not.toHaveBeenCalled();
    expect(view.webview.postMessage).toHaveBeenCalledWith(expect.objectContaining({ ok: false, message: expect.stringContaining('Confirm') }));
  });

  it('generateUI calls actions.generateUI when confirmed', async () => {
    (actions.generateUI as jest.Mock).mockResolvedValue({ ok: true, message: 'done' });
    const view = fakeWebviewView();
    provider.resolveWebviewView(view as any);
    await Promise.resolve();

    await view.send({ type: 'generateUI', confirmed: true });

    expect(actions.generateUI).toHaveBeenCalled();
  });

  it('validateCode populates diagnostics when a result is returned', async () => {
    const validationResult = { passed: false, errors: [{ file: 'lib/main.dart', message: 'bad', severity: 'error' as const }], warnings: [], output: '' };
    (actions.validateCode as jest.Mock).mockResolvedValue({ ok: false, message: 'issues found', data: validationResult });
    const view = fakeWebviewView();
    provider.resolveWebviewView(view as any);
    await Promise.resolve();

    await view.send({ type: 'validateCode' });

    expect(actions.populateDiagnostics).toHaveBeenCalledWith(diagnostics, expect.objectContaining({ name: 'project' }), validationResult);
  });
});
