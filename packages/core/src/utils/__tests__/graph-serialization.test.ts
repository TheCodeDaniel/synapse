import { serializeDesignGraph, deserializeDesignGraph, serializeProjectGraph, deserializeProjectGraph } from '../graph-serialization';
import { DesignGraph } from '../../types/design.graph';
import { ProjectGraph } from '../../types/project.graph';

function buildDesignGraph(): DesignGraph {
  return {
    id: 'g1',
    version: '1.0.0',
    figmaFileKey: 'k',
    fileName: 'f',
    importedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pages: [],
    components: new Map([
      [
        'c1',
        {
          id: 'c1',
          name: 'Button',
          description: '',
          type: 'component_set',
          variants: new Map([
            ['v1', { type: 'variant', id: 'v1', name: 'Default', properties: [], children: [], style: { effectSchedules: [], gridStyles: [] }, constraints: { vertical: 'stretch', horizontal: 'stretch' }, borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 }, backgroundColor: null }],
          ]),
          defaultVariant: 'v1',
          properties: [],
          exports: [],
          createdAt: '',
          updatedAt: '',
        },
      ],
    ]),
    variables: {
      colors: new Map([['col1', { key: 'col1', name: 'primary', resolvedValue: { r: 1, g: 0, b: 0, a: 1 }, scopes: [] }]]),
      scalars: new Map(),
      strings: new Map(),
      boolean: new Map(),
      composite: new Map(),
    },
    designTokens: { colors: [], spacing: [], typography: [], breakpoints: [], shadows: [], borders: [], opacity: [], radii: [], zIndices: [] },
    assets: { images: new Map(), svgs: new Map(), others: new Map() },
  };
}

describe('graph serialization', () => {
  it('round-trips a DesignGraph (including nested component variant Maps) through JSON', () => {
    const original = buildDesignGraph();

    const roundTripped = deserializeDesignGraph(
      JSON.parse(JSON.stringify(serializeDesignGraph(original)))
    );

    expect(roundTripped.components).toBeInstanceOf(Map);
    expect(roundTripped.components.get('c1')?.variants).toBeInstanceOf(Map);
    expect(roundTripped.components.get('c1')?.variants.get('v1')?.name).toBe('Default');
    expect(roundTripped.variables.colors.get('col1')?.name).toBe('primary');
  });

  it('produces a plain object with no Map instances when serializing (proving raw JSON.stringify would have lost data)', () => {
    const original = buildDesignGraph();
    const serialized = serializeDesignGraph(original);

    // The naive approach would have produced `{}` for a Map field:
    expect(JSON.stringify({ components: original.components })).toBe('{"components":{}}');
    // The serializer instead produces real keyed data that survives JSON:
    expect((serialized.components as Record<string, unknown>).c1).toBeDefined();
    expect(JSON.stringify(serialized)).toContain('"c1"');
  });

  it('round-trips a ProjectGraph (including nested theme Maps) through JSON', () => {
    const original = {
      widgets: new Map([['w1', { id: 'w1', name: 'Button' }]]),
      models: new Map(),
      services: new Map(),
      repositories: new Map(),
      themes: {
        colors: new Map([['primary', { name: 'primary', hexValue: '#FF0000' }]]),
        textStyles: new Map(),
        breakpoints: [],
        spacing: [],
        shadows: [],
        borders: [],
        radii: [],
      },
    } as unknown as ProjectGraph;

    const roundTripped = deserializeProjectGraph(
      JSON.parse(JSON.stringify(serializeProjectGraph(original)))
    );

    expect(roundTripped.widgets).toBeInstanceOf(Map);
    expect(roundTripped.widgets.get('w1')).toEqual({ id: 'w1', name: 'Button' });
    expect(roundTripped.themes.colors.get('primary')).toEqual({ name: 'primary', hexValue: '#FF0000' });
  });
});
