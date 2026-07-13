import axios from 'axios';
import { FigmaClient } from '../figma-client';
import { DesignCompiler } from '../design-compiler';
import { Logger } from '../../utils/logger';
import { ComponentNode, FrameNode, TextNode } from '../../types';
import fixture from './fixtures/figma-file-response.json';

jest.mock('axios');

const mockedAxios = axios as jest.Mocked<typeof axios>;

const variablesResponse = {
  variableCollections: {},
  variables: {
    'VariableID:1:1': {
      key: 'VariableID:1:1',
      name: 'color/primary',
      variableCollectionId: 'VariableCollectionId:1:1',
      resolvedType: 'COLOR',
      valuesByMode: { '1:0': [0.2, 0.4, 0.9, 1] },
      mode: '1:0',
    },
  },
};

async function compileFixture(): Promise<ReturnType<DesignCompiler['compile']> extends Promise<infer T> ? T : never> {
  const logger = new Logger({ level: 'error', toConsole: false, toFile: false });
  const client = new FigmaClient('token', null, logger);
  const compiler = new DesignCompiler(client);
  return compiler.compile('fixture-key');
}

describe('DesignCompiler', () => {
  beforeEach(() => {
    mockedAxios.create.mockReturnValue({
      get: jest.fn((url: string) => {
        if (url.includes('/variables/local')) {
          return Promise.resolve({ data: variablesResponse });
        }
        return Promise.resolve({ data: fixture });
      }),
    } as any);
  });

  it('reads the document tree from the real API shape and compiles pages/frames', async () => {
    const graph = await compileFixture();

    expect(graph.pages).toHaveLength(1);
    const screen = graph.pages[0].children[0] as FrameNode;
    expect(screen.type).toBe('frame');
    expect(screen.name).toBe('Screen');
    expect(screen.children).toHaveLength(3);
  });

  it('recurses into COMPONENT_SET children and populates variants instead of dropping them', async () => {
    const graph = await compileFixture();
    const screen = graph.pages[0].children[0] as FrameNode;
    const buttonSet = screen.children.find(n => n.name === 'Button') as ComponentNode;

    expect(buttonSet.type).toBe('component');
    expect(buttonSet.variants).toHaveLength(2);
    expect(buttonSet.variants[0].properties).toEqual([{ name: 'State', value: 'Default' }]);
    expect(buttonSet.variants[1].properties).toEqual([{ name: 'State', value: 'Hover' }]);
    // each variant's own children (the "Label" text node) must have been walked, not discarded
    expect(buttonSet.variants[0].children).toHaveLength(1);
    expect((buttonSet.variants[0].children[0] as TextNode).characters).toBe('Continue');
  });

  it('extracts real resolved color values from Figma variables instead of a hardcoded placeholder', async () => {
    const graph = await compileFixture();

    expect(graph.designTokens.colors).toEqual([
      { name: 'color/primary', value: { r: 0.2, g: 0.4, b: 0.9, a: 1 }, type: 'color' },
    ]);
  });

  it('maps Figma\'s UPPERCASE text-alignment enums to the internal lowercase literals', async () => {
    const graph = await compileFixture();
    const screen = graph.pages[0].children[0] as FrameNode;
    const title = screen.children.find(n => n.name === 'Title') as TextNode;

    expect(title.style.textAlignHorizontal).toBe('left');
    expect(title.style.textAlignVertical).toBe('top');
    expect(title.style.fontSize).toBe(20);
  });

  it('populates border radius and background color for instances (previously always hardcoded to zero/null)', async () => {
    const graph = await compileFixture();
    const screen = graph.pages[0].children[0] as FrameNode;
    const instance = screen.children.find(n => n.name === 'Button Instance') as any;

    expect(instance.borderRadius).toEqual({ topLeft: 8, topRight: 8, bottomLeft: 8, bottomRight: 8 });
    expect(instance.backgroundColor).toEqual({ r: 0.2, g: 0.4, b: 0.9, a: 1 });
  });
});
