/**
 * `DesignGraph`/`ProjectGraph` (and their nested registries) use `Map` for
 * fast key lookups, but `Map` does not survive `JSON.stringify`/`JSON.parse`
 * — it serializes to `{}`. Anything that persists these graphs to disk
 * (incremental sync, caching) must go through these helpers instead of a
 * raw `JSON.stringify`/`JSON.parse` round-trip.
 */

import { DesignGraph, FigmaComponent } from '../types/design.graph';
import { ProjectGraph } from '../types/project.graph';

function mapToObject<V>(map: Map<string, V>): Record<string, V> {
  return Object.fromEntries(map.entries());
}

function objectToMap<V>(obj: Record<string, V> | undefined | null): Map<string, V> {
  return new Map(Object.entries(obj ?? {}));
}

export function serializeDesignGraph(graph: DesignGraph): Record<string, unknown> {
  return {
    ...graph,
    components: mapToObject(
      new Map(
        Array.from(graph.components.entries()).map(([id, component]) => [
          id,
          { ...component, variants: mapToObject(component.variants) },
        ])
      )
    ),
    variables: {
      colors: mapToObject(graph.variables.colors),
      scalars: mapToObject(graph.variables.scalars),
      strings: mapToObject(graph.variables.strings),
      boolean: mapToObject(graph.variables.boolean),
      composite: mapToObject(graph.variables.composite),
    },
    assets: {
      images: mapToObject(graph.assets.images),
      svgs: mapToObject(graph.assets.svgs),
      others: mapToObject(graph.assets.others),
    },
  };
}

export function deserializeDesignGraph(data: Record<string, any>): DesignGraph {
  const rawComponents = (data.components ?? {}) as Record<string, any>;

  return {
    ...(data as DesignGraph),
    components: new Map(
      Object.entries(rawComponents).map(([id, component]) => [
        id,
        { ...component, variants: objectToMap(component.variants) } as FigmaComponent,
      ])
    ),
    variables: {
      colors: objectToMap(data.variables?.colors),
      scalars: objectToMap(data.variables?.scalars),
      strings: objectToMap(data.variables?.strings),
      boolean: objectToMap(data.variables?.boolean),
      composite: objectToMap(data.variables?.composite),
    },
    assets: {
      images: objectToMap(data.assets?.images),
      svgs: objectToMap(data.assets?.svgs),
      others: objectToMap(data.assets?.others),
    },
  };
}

export function serializeProjectGraph(graph: ProjectGraph): Record<string, unknown> {
  return {
    ...graph,
    widgets: mapToObject(graph.widgets),
    models: mapToObject(graph.models),
    services: mapToObject(graph.services),
    repositories: mapToObject(graph.repositories),
    themes: {
      ...graph.themes,
      colors: mapToObject(graph.themes.colors),
      textStyles: mapToObject(graph.themes.textStyles),
    },
  };
}

export function deserializeProjectGraph(data: Record<string, any>): ProjectGraph {
  return {
    ...(data as ProjectGraph),
    widgets: objectToMap(data.widgets),
    models: objectToMap(data.models),
    services: objectToMap(data.services),
    repositories: objectToMap(data.repositories),
    themes: {
      ...data.themes,
      colors: objectToMap(data.themes?.colors),
      textStyles: objectToMap(data.themes?.textStyles),
    },
  };
}
