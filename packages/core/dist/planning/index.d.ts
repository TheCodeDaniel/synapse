/**
 * Planning Engine - Compares Design Graph with Project Graph and produces implementation plans.
 */
import { DesignGraph, ProjectGraph, ImplementationPlan } from '../types';
export declare class PlanningEngine {
    compare(designGraph: DesignGraph, projectGraph: ProjectGraph): Promise<ImplementationPlan>;
    private findMatches;
    /**
     * Returns a node's children, uniformly across the DesignNode union.
     * `ComponentNode` has no `children` field of its own — its content lives
     * under `variants[].children` — so callers that only checked `.children`
     * could never reach a component's actual design content.
     */
    private getChildNodes;
    private collectComponentIds;
    private normalizeName;
    private findBestMatch;
    private identifyGaps;
    private collectAllComponentIds;
}
//# sourceMappingURL=index.d.ts.map