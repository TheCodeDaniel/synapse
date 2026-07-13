/**
 * Sync module - Handles incremental updates and change detection.
 */

import * as fs from 'fs';
import * as path from 'path';
import { DesignGraph, DesignNode, Task } from '../types';
import { deserializeDesignGraph, getChildNodes } from '../utils';

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

type SyncDomain = 'design' | 'code';

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

  /**
   * Compares the design/project graph files (and, for code, individual Dart
   * files under `lib/`) against the last time this method was called, then
   * records each file's own mtime as the new sync point for next time.
   * Change detection and bookkeeping are coupled deliberately — a caller
   * can't forget to persist sync state, which is what made every previous
   * run behave like a first run (nothing ever called the old
   * `saveSyncMetadata`).
   *
   * Sync markers are always a file's own mtime, never `Date.now()` — mixing
   * the JS wall clock with filesystem mtimes across two calls is a real
   * flakiness source (different clock sources/precision can disagree by a
   * few ms, especially in CI/virtualized filesystems), so everything here
   * compares mtime-to-previously-stored-mtime only.
   */
  detectChanges(designGraphPath: string, projectGraphPath: string): ChangeSet {
    const changes: ChangeSet = {
      figmaChanged: false,
      codeChanged: false,
      affectedDesignNodes: [],
      affectedCodeFiles: [],
    };

    const designGraphFile = path.resolve(designGraphPath);
    if (fs.existsSync(designGraphFile)) {
      const stat = fs.statSync(designGraphFile);
      changes.figmaChanged = this.hasChangedSinceLastRun('design', stat.mtimeMs);

      if (changes.figmaChanged) {
        try {
          const raw = JSON.parse(fs.readFileSync(designGraphFile, 'utf-8'));
          changes.affectedDesignNodes = this.getChangedNodeIds(deserializeDesignGraph(raw));
        } catch {
          changes.affectedDesignNodes = [];
        }
      }

      this.saveSyncMetadata('design', stat.mtimeMs);
    }

    const projectGraphFile = path.resolve(projectGraphPath);
    if (fs.existsSync(projectGraphFile)) {
      const stat = fs.statSync(projectGraphFile);
      changes.codeChanged = this.hasChangedSinceLastRun('code', stat.mtimeMs);

      // Must run before saveSyncMetadata('code', ...) below — it diffs Dart
      // file mtimes against the *previous* sync point, not this one.
      if (changes.codeChanged) {
        changes.affectedCodeFiles = this.getModifiedDartFiles();
      }

      this.saveSyncMetadata('code', stat.mtimeMs);
    }

    return changes;
  }

  async getRelevantTasks(changes: ChangeSet, allTasks: Task[]): Promise<string[]> {
    if (!changes.figmaChanged && !changes.codeChanged) {
      return [];
    }

    // Neither change set narrowed anything down (e.g. a graph changed but we
    // couldn't diff it) — conservatively treat every task as relevant rather
    // than silently generating nothing.
    if (!changes.affectedDesignNodes?.length && !changes.affectedCodeFiles?.length) {
      return allTasks.map(task => task.id);
    }

    const relevantTaskIds = new Set<string>();

    for (const task of allTasks) {
      if (changes.figmaChanged && task.designNodeId && changes.affectedDesignNodes?.includes(task.designNodeId)) {
        relevantTaskIds.add(task.id);
      }

      if (changes.codeChanged && task.targetFilePath) {
        for (const affectedFile of changes.affectedCodeFiles ?? []) {
          const normalizedAffected = path.normalize(affectedFile).toLowerCase();
          const normalizedTask = path.normalize(task.targetFilePath).toLowerCase();

          if (normalizedTask.includes(normalizedAffected) || normalizedAffected.includes(normalizedTask)) {
            relevantTaskIds.add(task.id);
            break;
          }
        }
      }
    }

    return [...relevantTaskIds];
  }

  saveSyncMetadata(domain: SyncDomain, timestampMs: number = Date.now()): void {
    try {
      fs.mkdirSync(this.cacheDir, { recursive: true });
      const metadataFile = path.join(this.cacheDir, `${domain}_last_sync.json`);
      fs.writeFileSync(metadataFile, JSON.stringify({ syncTime: timestampMs }, null, 2), 'utf-8');
    } catch {
      // Non-fatal: losing sync metadata just means the next run treats
      // everything as changed again, not a correctness issue.
    }
  }

  getLastSyncTime(domain: SyncDomain): number | undefined {
    try {
      const metadataFile = path.join(this.cacheDir, `${domain}_last_sync.json`);
      if (!fs.existsSync(metadataFile)) return undefined;

      const data = JSON.parse(fs.readFileSync(metadataFile, 'utf-8')) as { syncTime?: number };
      return data.syncTime;
    } catch {
      return undefined;
    }
  }

  private hasChangedSinceLastRun(domain: SyncDomain, currentMtime: number): boolean {
    const lastSync = this.getLastSyncTime(domain);
    if (lastSync === undefined) return true; // No previous sync, consider changed
    return currentMtime > lastSync;
  }

  private getChangedNodeIds(graph: DesignGraph): string[] {
    const nodeIds: string[] = [];

    const visit = (node: DesignNode): void => {
      nodeIds.push(node.id);
      for (const child of getChildNodes(node)) visit(child);
    };

    try {
      for (const page of graph.pages ?? []) {
        for (const node of page.children ?? []) visit(node);
      }
    } catch {
      // Return whatever was collected before the error
    }

    return nodeIds;
  }

  private getModifiedDartFiles(): string[] {
    const libDir = path.join(this.projectRoot, 'lib');
    if (!fs.existsSync(libDir)) return [];

    const lastSync = this.getLastSyncTime('code');
    if (lastSync === undefined) return []; // No previous sync to diff against

    const modifiedFiles: string[] = [];
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
