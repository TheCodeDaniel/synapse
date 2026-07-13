import { PlanningEngine } from '../index';
import { DesignGraph, ProjectGraph } from '../../types';

function emptyStyle() {
  return { effectSchedules: [], gridStyles: [] };
}

function emptyGeometry() {
  return {
    constraints: { vertical: 'stretch' as const, horizontal: 'stretch' as const },
    borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 },
    backgroundColor: null,
  };
}

/**
 * A design graph whose only reference to "PrimaryButton" lives inside a
 * COMPONENT_SET's variant children — the shape that, before the DesignNode
 * traversal fix, `collectComponentIds` could never reach (ComponentNode has
 * no top-level `children`, only `variants`).
 */
function buildDesignGraphWithNestedInstance(): DesignGraph {
  return {
    id: 'g1',
    version: '1.0.0',
    figmaFileKey: 'k',
    fileName: 'f',
    importedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    pages: [
      {
        id: 'p1',
        name: 'Page',
        type: 'page',
        order: 0,
        children: [
          {
            type: 'component',
            id: 'c1',
            name: 'ButtonSet',
            description: '',
            overrides: [],
            style: emptyStyle(),
            variants: [
              {
                type: 'variant',
                id: 'v1',
                name: 'State=Default',
                properties: [{ name: 'State', value: 'Default' }],
                style: emptyStyle(),
                ...emptyGeometry(),
                children: [
                  {
                    type: 'instance',
                    id: 'i1',
                    name: 'PrimaryButton',
                    componentId: 'c1',
                    children: [],
                    overrides: [],
                    style: emptyStyle(),
                    ...emptyGeometry(),
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
    components: new Map(),
    variables: { colors: new Map(), scalars: new Map(), strings: new Map(), boolean: new Map(), composite: new Map() },
    designTokens: { colors: [], spacing: [], typography: [], breakpoints: [], shadows: [], borders: [], opacity: [], radii: [], zIndices: [] },
    assets: { images: new Map(), svgs: new Map(), others: new Map() },
  };
}

function buildProjectGraphWithWidget(name: string): ProjectGraph {
  const widgets = new Map([
    [
      'w1',
      {
        id: 'w1',
        name,
        filePath: `lib/widgets/${name}.dart`,
        relativePath: `widgets/${name}.dart`,
        type: 'stateless' as const,
        extends: 'StatelessWidget' as const,
        parameters: [],
        hasChildren: false,
        childCount: 0,
        imports: [],
        isPublic: true,
      },
    ],
  ]);

  // Only `widgets` is exercised by PlanningEngine.compare(); the rest of
  // ProjectGraph is irrelevant to this test's behavior.
  return { widgets } as unknown as ProjectGraph;
}

describe('PlanningEngine', () => {
  it('finds widget matches nested inside a ComponentNode.variants[].children, not just top-level children', async () => {
    const engine = new PlanningEngine();
    const designGraph = buildDesignGraphWithNestedInstance();
    const projectGraph = buildProjectGraphWithWidget('PrimaryButton');

    const plan = await engine.compare(designGraph, projectGraph);

    const reuseTasks = plan.tasks.filter(t => t.type === 'reuse_widget' || t.type === 'update_widget');
    expect(reuseTasks.some(t => t.existingWidgetId === 'w1')).toBe(true);
  });

  it('creates a reuse task for a discovered pattern that matches an existing widget', async () => {
    const engine = new PlanningEngine();
    const designGraph: DesignGraph = { ...buildDesignGraphWithNestedInstance(), pages: [], discoveredPatterns: [
      { suggestedName: 'ProductCard', occurrenceCount: 3, nodeIds: ['n1', 'n2', 'n3'], fingerprint: 'fp1' },
    ] };
    const projectGraph = buildProjectGraphWithWidget('ProductCard');

    const plan = await engine.compare(designGraph, projectGraph);

    const patternTask = plan.tasks.find(t => t.designNodeId === 'n1');
    expect(patternTask).toBeDefined();
    expect(patternTask?.existingWidgetId).toBe('w1');
    expect(plan.summary.widgetsToReuse).toBeGreaterThan(0);
  });

  it('creates a create_widget task for a discovered pattern with no matching widget', async () => {
    const engine = new PlanningEngine();
    const designGraph: DesignGraph = { ...buildDesignGraphWithNestedInstance(), pages: [], discoveredPatterns: [
      { suggestedName: 'PromoBanner', occurrenceCount: 2, nodeIds: ['n4', 'n5'], fingerprint: 'fp2' },
    ] };
    const projectGraph = { widgets: new Map() } as unknown as ProjectGraph;

    const plan = await engine.compare(designGraph, projectGraph);

    const patternTask = plan.tasks.find(t => t.designNodeId === 'n4');
    expect(patternTask?.type).toBe('create_widget');
    expect(patternTask?.targetFilePath).toBe('lib/widgets/promobanner.dart');
  });
});
