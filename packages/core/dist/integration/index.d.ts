/**
 * Integration module - Merges generated files into the Flutter project.
 */
export interface IntegrationResult {
    filesModified: number;
    filesCreated: number;
    routesUpdated: string[];
    errors: string[];
}
export declare class ProjectIntegrator {
    private projectRoot;
    constructor(projectRoot: string);
    integrateGeneratedFiles(files: Array<{
        filePath: string;
        content: string;
    }>): Promise<IntegrationResult>;
    updateRouteRegistrations(routeFile: string, routesToRegister: Array<{
        path: string;
        widgetName: string;
    }>): Promise<void>;
    updateLocalization(localeFile: string, keysToRegister: Array<{
        key: string;
        value: Record<string, string>;
    }>): Promise<void>;
    updateAssets(assetsToRegister: Array<{
        path: string;
        type: string;
    }>): Promise<void>;
    private isRouteFile;
    private toPascalCase;
}
//# sourceMappingURL=index.d.ts.map