/**
 * Sync module - Handles incremental updates and change detection.
 */
export interface ChangeSet {
    figmaChanged: boolean;
    codeChanged: boolean;
    affectedDesignNodes?: string[];
    affectedCodeFiles?: string[];
}
export interface SyncOptions {
    watchFigmaCache: boolean;
    watchCodeChanges: boolean;
    incrementalAnalysis: boolean;
}
export declare class IncrementalSync {
    private cacheDir;
    private projectRoot;
    private options;
    constructor(projectRoot: string, cacheDir: string, options?: Partial<SyncOptions>);
    detectChanges(designGraphPath: string, projectGraphPath: string): ChangeSet;
    getRelevantTasks(changes: ChangeSet, allTasks: Array<{
        id: string;
        type: string;
        designNodeId?: string;
        targetFilePath?: string;
    }>): Promise<string[]>;
    saveSyncMetadata(graphType: string, timestampMs: number, filePath: string): void;
    getLastSyncTime(graphType: string): number | undefined;
    private hasChangedSinceLastRun;
    private getChangedNodeIds;
    private getModifiedDartFiles;
    private scanDartFilesRecursive;
    clearSyncMetadata(): void;
}
//# sourceMappingURL=index.d.ts.map