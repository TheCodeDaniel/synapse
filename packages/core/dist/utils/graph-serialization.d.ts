/**
 * `DesignGraph`/`ProjectGraph` (and their nested registries) use `Map` for
 * fast key lookups, but `Map` does not survive `JSON.stringify`/`JSON.parse`
 * — it serializes to `{}`. Anything that persists these graphs to disk
 * (incremental sync, caching) must go through these helpers instead of a
 * raw `JSON.stringify`/`JSON.parse` round-trip.
 */
import { DesignGraph } from '../types/design.graph';
import { ProjectGraph } from '../types/project.graph';
export declare function serializeDesignGraph(graph: DesignGraph): Record<string, unknown>;
export declare function deserializeDesignGraph(data: Record<string, any>): DesignGraph;
export declare function serializeProjectGraph(graph: ProjectGraph): Record<string, unknown>;
export declare function deserializeProjectGraph(data: Record<string, any>): ProjectGraph;
//# sourceMappingURL=graph-serialization.d.ts.map