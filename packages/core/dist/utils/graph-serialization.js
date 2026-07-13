"use strict";
/**
 * `DesignGraph`/`ProjectGraph` (and their nested registries) use `Map` for
 * fast key lookups, but `Map` does not survive `JSON.stringify`/`JSON.parse`
 * — it serializes to `{}`. Anything that persists these graphs to disk
 * (incremental sync, caching) must go through these helpers instead of a
 * raw `JSON.stringify`/`JSON.parse` round-trip.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.serializeDesignGraph = serializeDesignGraph;
exports.deserializeDesignGraph = deserializeDesignGraph;
exports.serializeProjectGraph = serializeProjectGraph;
exports.deserializeProjectGraph = deserializeProjectGraph;
function mapToObject(map) {
    return Object.fromEntries(map.entries());
}
function objectToMap(obj) {
    return new Map(Object.entries(obj ?? {}));
}
function serializeDesignGraph(graph) {
    return {
        ...graph,
        components: mapToObject(new Map(Array.from(graph.components.entries()).map(([id, component]) => [
            id,
            { ...component, variants: mapToObject(component.variants) },
        ]))),
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
function deserializeDesignGraph(data) {
    const rawComponents = (data.components ?? {});
    return {
        ...data,
        components: new Map(Object.entries(rawComponents).map(([id, component]) => [
            id,
            { ...component, variants: objectToMap(component.variants) },
        ])),
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
function serializeProjectGraph(graph) {
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
function deserializeProjectGraph(data) {
    return {
        ...data,
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
//# sourceMappingURL=graph-serialization.js.map