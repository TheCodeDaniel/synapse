/**
 * Flutter Project Analyzer - Scans a Flutter project and generates a Project Graph.
 */
import { ProjectGraph } from '../types';
export declare class FlutterAnalyzer {
    private rootPath;
    private logger?;
    constructor(rootPath: string);
    analyze(): Promise<ProjectGraph>;
    private readPubspec;
    private scanWidgets;
    private scanModels;
    private scanServices;
    private scanRepositories;
    private findDartFiles;
    private extractWidgets;
    private createWidgetDef;
    private extractModels;
    private extractServices;
    private extractRepositories;
    private analyzeThemes;
    private extractThemeData;
    private analyzeRouting;
    private analyzeLocalization;
    private readDependencies;
    private scanAssets;
    private detectConventions;
    private analyzeArchitecture;
    private detectFolderStructure;
    private hasDependency;
    private getFlutterVersion;
    private getDartVersion;
}
//# sourceMappingURL=flutter-analyzer.d.ts.map