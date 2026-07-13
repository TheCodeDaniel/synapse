import axios from 'axios';
import { FigmaClient } from '../../compiler/figma-client';
import { DesignCompiler } from '../../compiler/design-compiler';
import { Logger } from '../../utils/logger';
import { ComponentDiscoveryEngine } from '../index';
import { DesignGraph, FrameNode } from '../../types';
import fixture from './fixtures/figma-file-with-repeated-cards.json';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

async function compileFixture(): Promise<DesignGraph> {
  mockedAxios.create.mockReturnValue({
    get: jest.fn((url: string) => {
      if (url.includes('/variables/local')) {
        return Promise.resolve({ data: { variableCollections: {}, variables: {} } });
      }
      return Promise.resolve({ data: fixture });
    }),
  } as any);

  const logger = new Logger({ level: 'error', toConsole: false, toFile: false });
  const client = new FigmaClient('token', null, logger);
  const compiler = new DesignCompiler(client);
  return compiler.compile('fixture-key');
}

describe('ComponentDiscoveryEngine', () => {
  it('detects 3 differently-named, structurally-identical cards as one repeated pattern', async () => {
    const graph = await compileFixture();
    const engine = new ComponentDiscoveryEngine();

    const patterns = engine.discover(graph);

    expect(patterns).toHaveLength(1);
    expect(patterns[0].occurrenceCount).toBe(3);
    expect(patterns[0].nodeIds).toEqual(['2:1', '2:5', '2:9']);
  });

  it('does not group the structurally-different banner frame with the cards', async () => {
    const graph = await compileFixture();
    const engine = new ComponentDiscoveryEngine();

    const patterns = engine.discover(graph);

    const nodeIds = patterns.flatMap(p => p.nodeIds);
    expect(nodeIds).not.toContain('3:1');
  });

  it('tolerates minor size differences via bucketing (158/160/163 wide, 220/220/218 tall all match)', async () => {
    const graph = await compileFixture();
    const cardWidths = (graph.pages[0].children as FrameNode[])
      .filter(n => n.name.includes('Card') || n.name === 'ProductCard')
      .map(n => n.width);
    expect(cardWidths).toEqual([158, 160, 163]);

    const engine = new ComponentDiscoveryEngine();
    const patterns = engine.discover(graph);
    expect(patterns[0].occurrenceCount).toBe(3);
  });

  it('returns no patterns when nothing repeats', () => {
    const engine = new ComponentDiscoveryEngine();
    const emptyGraph: DesignGraph = {
      id: 'g', version: '1', figmaFileKey: 'k', fileName: 'f', importedAt: '', updatedAt: '',
      pages: [{ id: 'p1', name: 'Page', type: 'page', order: 0, children: [] }],
      components: new Map(),
      variables: { colors: new Map(), scalars: new Map(), strings: new Map(), boolean: new Map(), composite: new Map() },
      designTokens: { colors: [], spacing: [], typography: [], breakpoints: [], shadows: [], borders: [], opacity: [], radii: [], zIndices: [] },
      assets: { images: new Map(), svgs: new Map(), others: new Map() },
    };

    expect(engine.discover(emptyGraph)).toEqual([]);
  });
});
