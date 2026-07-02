/**
 * Planning Engine - Compares Design Graph with Project Graph and produces implementation plans.
 */
import { DesignGraph, ProjectGraph, ImplementationPlan } from '../types';
export declare class PlanningEngine {
    compare(designGraph: DesignGraph, projectGraph: ProjectGraph): Promise<ImplementationPlan>;
    private findMatches;
    private collectComponentIds;
    private normalizeName;
    private findBestMatch;
    private identifyGaps;
    private collectAllComponentIds;
}
//# sourceMappingURL=index.d.ts.map