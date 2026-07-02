/**
 * Sync module - Handles incremental updates and change detection.
 */

import * as fs from 'fs';
import * as path from 'path';

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

export class IncrementalSync {
  private cacheDir: string;
  private projectRoot: string;
  private options: SyncOptions;

  constructor(projectRoot: string, cacheDir: string, options?: Partial<SyncOptions>) {
    this.projectRoot = path.resolve(projectRoot);
    this.cacheDir = path.resolve(cacheDir);
    this.options = {
      watchFigmaCache: false,
      watchCodeChanges: true,
      incrementalAnalysis: true,
      ...options,
    };
  }

  detectChanges(
    designGraphPath: string,
    projectGraphPath: string
  ): ChangeSet {
    const changes: ChangeSet = {
      figmaChanged: false,
      codeChanged: false,
      affectedDesignNodes: [],
      affectedCodeFiles: [],
    };

    // Check if Figma cache has changed
    const designGraphFile = path.resolve(designGraphPath);
    if (fs.existsSync(designGraphFile)) {
      const stat = fs.statSync(designGraphFile);
      changes.figmaChanged = this.hasChangedSinceLastRun(
        'design_graph',
        stat.mtimeMs,
        designGraphFile
      );

      // Determine which nodes changed (simplified - in production would diff JSON)
      try {
        const content = fs.readFileSync(designGraphFile, 'utf-8');
        const graph = JSON.parse(content);
        if (graph.updatedAt !== this.getLastSyncTime('design')) {
          changes.affectedDesignNodes = this.getChangedNodeIds(graph);
        }
      } catch {
        changes.figmaChanged = true;
      }
    }

    // Check if code files have changed
    const projectGraphFile = path.resolve(projectGraphPath);
    if (fs.existsSync(projectGraphFile)) {
      const stat = fs.statSync(projectGraphFile);
      changes.codeChanged = this.hasChangedSinceLastRun(
        'project_graph',
        stat.mtimeMs,
        projectGraphFile
      );

      // Find modified Dart files in lib/
      if (changes.codeChanged) {
        changes.affectedCodeFiles = this.getModifiedDartFiles();
      }
    }

    return changes;
  }

  async getRelevantTasks(
    changes: ChangeSet,
    allTasks: Array<{ id: string; type: string; designNodeId?: string; targetFilePath?: string }>
  ): Promise<string[]> {
    const relevantTaskIds: string[] = [];

    for (const task of allTasks) {
      if (!changes.codeChanged && !changes.figmaChanged) {
        continue; // No changes, no re-generation needed
      }

      // If design changed, check if task is related to affected nodes
      if (changes.figmaChanged && task.designNodeId) {
        if (changes.affectedDesignNodes?.includes(task.designNodeId)) {
          relevantTaskIds.push(task.id);
        }
      }

      // If code changed, check if task is related to affected files
      if (changes.codeChanged && task.targetFilePath) {
        for (const affectedFile of (changes.affectedCodeFiles ?? [])) {
          const normalizedAffected = path.normalize(affectedFile).toLowerCase();
          const normalizedTask = path.normalize(task.targetFilePath || '').toLowerCase();

          // Check if the affected file matches or is a parent directory
          if (normalizedTask.includes(normalizedAffected) || normalizedAffected.includes(normalizedTask)) {
            relevantTaskIds.push(task.id);
            break;
          }
        }
      }

      // If no specific filters apply, include tasks that depend on changed areas
      if (!changes.affectedDesignNodes?.length && !changes.affectedCodeFiles?.length) {
        relevantTaskIds.push(task.id);
      }
    }

    return [...new Set(relevantTaskIds)];
  }

  saveSyncMetadata(graphType: string, timestampMs: number, filePath: string): void {
    try {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      const metadataFile = path.join(
        this.cacheDir,
        `${graphType}_last_sync.json`
      );

      // Preserve existing data if available
      let existingData: Record<string, unknown> = {};
      if (fs.existsSync(metadataFile)) {
        try {
          existingData = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
        } catch {
          // Ignore parse errors
        }
      }

      const data = {
        ...existingData,
        [filePath]: {
          syncTime: timestampMs,
          lastModified: Date.now(),
        },
      };

      fs.writeFileSync(metadataFile, JSON.stringify(data, null, 2), 'utf-8');
    } catch {
      // Silently fail - metadata is not critical for prototype
    }
  }

  getLastSyncTime(graphType: string): number | undefined {
    try {
      const metadataFile = path.join(
        this.cacheDir,
        `${graphType}_last_sync.json`
      );

      if (!fs.existsSync(metadataFile)) return undefined;

      const data = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
      // Return the most recent sync time across all files
      let maxTime = 0;
      for (const entry of Object.values(data)) {
        const e = entry as { syncTime?: number };
        if (e.syncTime !== undefined && e.syncTime > maxTime) maxTime = e.syncTime;
      }
      return maxTime || undefined;
    } catch {
      return undefined;
    }
  }

  private hasChangedSinceLastRun(
    graphType: string,
    currentMtime: number,
    filePath: string
  ): boolean {
    const lastSync = this.getLastSyncTime(graphType);
    if (!lastSync) return true; // No previous sync, consider changed
    return currentMtime !== lastSync;
  }

  private getChangedNodeIds(graphData: any): string[] {
    const nodeIds: string[] = [];

    const extractIds = (node: any): void => {
      if (!node) return;
      if (node.id) nodeIds.push(node.id);
      if (Array.isArray(node.children)) {
        for (const child of node.children) {
          extractIds(child);
        }
      }
    };

    try {
      // Handle pages structure
      if (graphData.pages?.length > 0) {
        for (const page of graphData.pages) {
          extractIds(page);
        }
      } else if (graphData.doc?.children) {
        for (const child of graphData.doc.children) {
          extractIds(child);
        }
      }
    } catch {
      // Return all IDs on error
    }

    return nodeIds;
  }

  private getModifiedDartFiles(): string[] {
    const libDir = path.join(this.projectRoot, 'lib');
    if (!fs.existsSync(libDir)) return [];

    const modifiedFiles: string[] = [];
    const lastSync = this.getLastSyncTime('code');

    if (!lastSync) return []; // No previous sync

    const dartFiles = this.scanDartFilesRecursive(libDir);

    for (const file of dartFiles) {
      try {
        const stat = fs.statSync(file);
        if (stat.mtimeMs > lastSync) {
          modifiedFiles.push(path.relative(this.projectRoot, file));
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return modifiedFiles;
  }

  private scanDartFilesRecursive(dir: string): string[] {
    const files: string[] = [];
    try {
      const items = fs.readdirSync(dir, { withFileTypes: true });
      for (const item of items) {
        const fullPath = path.join(dir, item.name);
        if (item.isDirectory()) {
          files.push(...this.scanDartFilesRecursive(fullPath));
        } else if (item.isFile() && item.name.endsWith('.dart')) {
          files.push(fullPath);
        }
      }
    } catch {
      // Skip directories that can't be read
    }
    return files;
  }

  clearSyncMetadata(): void {
    try {
      if (fs.existsSync(this.cacheDir)) {
        const files = fs.readdirSync(this.cacheDir);
        for (const file of files) {
          if (file.includes('_last_sync.json')) {
            fs.unlinkSync(path.join(this.cacheDir, file));
          }
        }
      }
    } catch {
      // Silently fail
    }
  }
}