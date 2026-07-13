import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { IncrementalSync } from '../index';

function makeTempDir(prefix: string): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), prefix));
}

/** Sets a file's mtime deliberately into the future so mtime-based comparisons are deterministic, without relying on real wall-clock sleeps in tests. */
function touchFuture(filePath: string, offsetMs = 60_000): void {
  const future = new Date(Date.now() + offsetMs);
  fs.utimesSync(filePath, future, future);
}

function writeDesignGraph(filePath: string, updatedAt: string): void {
  fs.writeFileSync(
    filePath,
    JSON.stringify({
      id: 'g1',
      version: '1.0.0',
      figmaFileKey: 'k',
      fileName: 'f',
      importedAt: updatedAt,
      updatedAt,
      pages: [
        {
          id: 'p1',
          name: 'Page',
          type: 'page',
          order: 0,
          children: [
            {
              type: 'frame',
              id: 'n1',
              name: 'Frame',
              typeName: 'FRAME',
              x: 0, y: 0, width: 1, height: 1,
              paddingLeft: 0, paddingRight: 0, paddingTop: 0, paddingBottom: 0,
              itemCount: 0,
              layoutMode: 'none',
              primaryAxisAlignItems: 'min',
              counterAxisAlignItems: 'min',
              primaryAxisSpacing: 0,
              counterAxisSpacing: 0,
              constraints: { vertical: 'stretch', horizontal: 'stretch' },
              clipsContent: false,
              backgroundColor: null,
              borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 },
              children: [],
              style: { effectSchedules: [], gridStyles: [] },
            },
          ],
        },
      ],
      components: {},
      variables: { colors: {}, scalars: {}, strings: {}, boolean: {}, composite: {} },
      designTokens: { colors: [], spacing: [], typography: [], breakpoints: [], shadows: [], borders: [], opacity: [], radii: [], zIndices: [] },
      assets: { images: {}, svgs: {}, others: {} },
    })
  );
}

describe('IncrementalSync', () => {
  let projectRoot: string;
  let cacheDir: string;
  let designGraphPath: string;
  let projectGraphPath: string;
  let dartFilePath: string;

  beforeEach(() => {
    projectRoot = makeTempDir('di-sync-project-');
    cacheDir = makeTempDir('di-sync-cache-');
    fs.mkdirSync(path.join(projectRoot, 'lib'), { recursive: true });
    dartFilePath = path.join(projectRoot, 'lib', 'main.dart');
    fs.writeFileSync(dartFilePath, 'void main() {}');

    designGraphPath = path.join(projectRoot, 'design-graph.json');
    projectGraphPath = path.join(projectRoot, 'project-graph.json');
    writeDesignGraph(designGraphPath, '2026-01-01T00:00:00.000Z');
    fs.writeFileSync(projectGraphPath, JSON.stringify({ id: 'pg1' }));
  });

  afterEach(() => {
    fs.rmSync(projectRoot, { recursive: true, force: true });
    fs.rmSync(cacheDir, { recursive: true, force: true });
  });

  it('treats the first run as fully changed and extracts design node ids', () => {
    const sync = new IncrementalSync(projectRoot, cacheDir);

    const changes = sync.detectChanges(designGraphPath, projectGraphPath);

    expect(changes.figmaChanged).toBe(true);
    expect(changes.codeChanged).toBe(true);
    expect(changes.affectedDesignNodes).toContain('n1');
  });

  it('reports no changes on a second run when nothing changed — the core regression this fixes', () => {
    const sync = new IncrementalSync(projectRoot, cacheDir);
    sync.detectChanges(designGraphPath, projectGraphPath);

    const secondRun = sync.detectChanges(designGraphPath, projectGraphPath);

    expect(secondRun.figmaChanged).toBe(false);
    expect(secondRun.codeChanged).toBe(false);
    expect(secondRun.affectedCodeFiles).toEqual([]);
  });

  it('detects a modified Dart file between runs (getModifiedDartFiles previously always returned [])', () => {
    const sync = new IncrementalSync(projectRoot, cacheDir);
    sync.detectChanges(designGraphPath, projectGraphPath);

    fs.writeFileSync(dartFilePath, 'void main() { print(1); }');
    touchFuture(dartFilePath);
    fs.writeFileSync(projectGraphPath, JSON.stringify({ id: 'pg1', v: 2 }));
    touchFuture(projectGraphPath);

    const secondRun = sync.detectChanges(designGraphPath, projectGraphPath);

    expect(secondRun.codeChanged).toBe(true);
    expect(secondRun.affectedCodeFiles).toContain(path.join('lib', 'main.dart'));
  });

  it('detects a changed design graph via file mtime on the next run', () => {
    const sync = new IncrementalSync(projectRoot, cacheDir);
    sync.detectChanges(designGraphPath, projectGraphPath);

    writeDesignGraph(designGraphPath, '2026-02-01T00:00:00.000Z');
    touchFuture(designGraphPath);

    const secondRun = sync.detectChanges(designGraphPath, projectGraphPath);

    expect(secondRun.figmaChanged).toBe(true);
    expect(secondRun.affectedDesignNodes).toContain('n1');
  });

  it('getRelevantTasks only returns tasks matching affected design nodes or files', async () => {
    const sync = new IncrementalSync(projectRoot, cacheDir);
    const tasks = [
      { id: 't1', type: 'create_widget' as const, priority: 'high' as const, order: 0, title: 't1', description: '', designNodeId: 'n1', targetFilePath: '', requiresManualReview: false, dependencies: [], status: 'pending' as const },
      { id: 't2', type: 'create_widget' as const, priority: 'high' as const, order: 1, title: 't2', description: '', designNodeId: 'n2', targetFilePath: '', requiresManualReview: false, dependencies: [], status: 'pending' as const },
    ];

    const relevant = await sync.getRelevantTasks(
      { figmaChanged: true, codeChanged: false, affectedDesignNodes: ['n1'], affectedCodeFiles: [] },
      tasks
    );

    expect(relevant).toEqual(['t1']);
  });
});
