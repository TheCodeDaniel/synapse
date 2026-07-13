/**
 * Minimal manual mock of the `vscode` module for unit tests.
 *
 * `vscode` isn't a real installed package (it's injected by the real
 * extension host at runtime) — this mock only implements the surface
 * `extension.ts` actually touches, wired via jest's `moduleNameMapper`
 * rather than a `vscode` npm dependency.
 */

export const __registeredCommands = new Map<string, (...args: unknown[]) => unknown>();
export const __shownMessages: { kind: 'info' | 'error' | 'warning'; message: string }[] = [];

export function __reset(): void {
  __registeredCommands.clear();
  __shownMessages.length = 0;
}

export enum ProgressLocation {
  SourceControl = 1,
  Window = 10,
  Notification = 15,
}

export enum DiagnosticSeverity {
  Error = 0,
  Warning = 1,
  Information = 2,
  Hint = 3,
}

export class Range {
  constructor(
    public startLine: number,
    public startCharacter: number,
    public endLine: number,
    public endCharacter: number
  ) {}
}

export class Diagnostic {
  constructor(
    public range: Range,
    public message: string,
    public severity: DiagnosticSeverity
  ) {}
}

export class Uri {
  private constructor(public readonly fsPath: string) {}
  static file(fsPath: string): Uri {
    return new Uri(fsPath);
  }
}

function makeDiagnosticCollection() {
  const entries = new Map<string, Diagnostic[]>();
  return {
    clear: jest.fn(() => entries.clear()),
    set: jest.fn((uri: Uri, diagnostics: Diagnostic[]) => entries.set(uri.fsPath, diagnostics)),
    get: (uri: Uri) => entries.get(uri.fsPath),
    dispose: jest.fn(),
  };
}

export const languages = {
  createDiagnosticCollection: jest.fn(() => makeDiagnosticCollection()),
};

export const commands = {
  registerCommand: jest.fn((id: string, handler: (...args: unknown[]) => unknown) => {
    __registeredCommands.set(id, handler);
    return { dispose: jest.fn() };
  }),
  executeCommand: jest.fn(async (id: string, ...args: unknown[]) => {
    const handler = __registeredCommands.get(id);
    return handler ? handler(...args) : undefined;
  }),
};

export const window = {
  showInputBox: jest.fn(async () => undefined as string | undefined),
  showInformationMessage: jest.fn(async (message: string) => {
    __shownMessages.push({ kind: 'info', message });
    return undefined as string | undefined;
  }),
  showErrorMessage: jest.fn(async (message: string) => {
    __shownMessages.push({ kind: 'error', message });
    return undefined as string | undefined;
  }),
  showWarningMessage: jest.fn(async (message: string) => {
    __shownMessages.push({ kind: 'warning', message });
    return undefined as string | undefined;
  }),
  withProgress: jest.fn(async (_options: unknown, task: (progress: { report: (v: unknown) => void }) => Promise<unknown>) => {
    return task({ report: jest.fn() });
  }),
};

export const workspace = {
  workspaceFolders: undefined as Array<{ uri: Uri; name: string; index: number }> | undefined,
  getConfiguration: jest.fn(() => ({
    get: jest.fn(() => undefined),
  })),
};
