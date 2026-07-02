"use strict";
/**
 * Sync module - Handles incremental updates and change detection.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.IncrementalSync = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class IncrementalSync {
    cacheDir;
    projectRoot;
    options;
    constructor(projectRoot, cacheDir, options) {
        this.projectRoot = path.resolve(projectRoot);
        this.cacheDir = path.resolve(cacheDir);
        this.options = {
            watchFigmaCache: false,
            watchCodeChanges: true,
            incrementalAnalysis: true,
            ...options,
        };
    }
    detectChanges(designGraphPath, projectGraphPath) {
        const changes = {
            figmaChanged: false,
            codeChanged: false,
            affectedDesignNodes: [],
            affectedCodeFiles: [],
        };
        // Check if Figma cache has changed
        const designGraphFile = path.resolve(designGraphPath);
        if (fs.existsSync(designGraphFile)) {
            const stat = fs.statSync(designGraphFile);
            changes.figmaChanged = this.hasChangedSinceLastRun('design_graph', stat.mtimeMs, designGraphFile);
            // Determine which nodes changed (simplified - in production would diff JSON)
            try {
                const content = fs.readFileSync(designGraphFile, 'utf-8');
                const graph = JSON.parse(content);
                if (graph.updatedAt !== this.getLastSyncTime('design')) {
                    changes.affectedDesignNodes = this.getChangedNodeIds(graph);
                }
            }
            catch {
                changes.figmaChanged = true;
            }
        }
        // Check if code files have changed
        const projectGraphFile = path.resolve(projectGraphPath);
        if (fs.existsSync(projectGraphFile)) {
            const stat = fs.statSync(projectGraphFile);
            changes.codeChanged = this.hasChangedSinceLastRun('project_graph', stat.mtimeMs, projectGraphFile);
            // Find modified Dart files in lib/
            if (changes.codeChanged) {
                changes.affectedCodeFiles = this.getModifiedDartFiles();
            }
        }
        return changes;
    }
    async getRelevantTasks(changes, allTasks) {
        const relevantTaskIds = [];
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
    saveSyncMetadata(graphType, timestampMs, filePath) {
        try {
            fs.mkdirSync(this.cacheDir, { recursive: true });
            const metadataFile = path.join(this.cacheDir, `${graphType}_last_sync.json`);
            // Preserve existing data if available
            let existingData = {};
            if (fs.existsSync(metadataFile)) {
                try {
                    existingData = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
                }
                catch {
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
        }
        catch {
            // Silently fail - metadata is not critical for prototype
        }
    }
    getLastSyncTime(graphType) {
        try {
            const metadataFile = path.join(this.cacheDir, `${graphType}_last_sync.json`);
            if (!fs.existsSync(metadataFile))
                return undefined;
            const data = JSON.parse(fs.readFileSync(metadataFile, 'utf-8'));
            // Return the most recent sync time across all files
            let maxTime = 0;
            for (const entry of Object.values(data)) {
                const e = entry;
                if (e.syncTime !== undefined && e.syncTime > maxTime)
                    maxTime = e.syncTime;
            }
            return maxTime || undefined;
        }
        catch {
            return undefined;
        }
    }
    hasChangedSinceLastRun(graphType, currentMtime, filePath) {
        const lastSync = this.getLastSyncTime(graphType);
        if (!lastSync)
            return true; // No previous sync, consider changed
        return currentMtime !== lastSync;
    }
    getChangedNodeIds(graphData) {
        const nodeIds = [];
        const extractIds = (node) => {
            if (!node)
                return;
            if (node.id)
                nodeIds.push(node.id);
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
            }
            else if (graphData.doc?.children) {
                for (const child of graphData.doc.children) {
                    extractIds(child);
                }
            }
        }
        catch {
            // Return all IDs on error
        }
        return nodeIds;
    }
    getModifiedDartFiles() {
        const libDir = path.join(this.projectRoot, 'lib');
        if (!fs.existsSync(libDir))
            return [];
        const modifiedFiles = [];
        const lastSync = this.getLastSyncTime('code');
        if (!lastSync)
            return []; // No previous sync
        const dartFiles = this.scanDartFilesRecursive(libDir);
        for (const file of dartFiles) {
            try {
                const stat = fs.statSync(file);
                if (stat.mtimeMs > lastSync) {
                    modifiedFiles.push(path.relative(this.projectRoot, file));
                }
            }
            catch {
                // Skip files that can't be read
            }
        }
        return modifiedFiles;
    }
    scanDartFilesRecursive(dir) {
        const files = [];
        try {
            const items = fs.readdirSync(dir, { withFileTypes: true });
            for (const item of items) {
                const fullPath = path.join(dir, item.name);
                if (item.isDirectory()) {
                    files.push(...this.scanDartFilesRecursive(fullPath));
                }
                else if (item.isFile() && item.name.endsWith('.dart')) {
                    files.push(fullPath);
                }
            }
        }
        catch {
            // Skip directories that can't be read
        }
        return files;
    }
    clearSyncMetadata() {
        try {
            if (fs.existsSync(this.cacheDir)) {
                const files = fs.readdirSync(this.cacheDir);
                for (const file of files) {
                    if (file.includes('_last_sync.json')) {
                        fs.unlinkSync(path.join(this.cacheDir, file));
                    }
                }
            }
        }
        catch {
            // Silently fail
        }
    }
}
exports.IncrementalSync = IncrementalSync;
//# sourceMappingURL=index.js.map