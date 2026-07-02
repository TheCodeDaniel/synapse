"use strict";
/**
 * Planning Engine - Compares Design Graph with Project Graph and produces implementation plans.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.PlanningEngine = void 0;
const uuid_1 = require("uuid");
class PlanningEngine {
    async compare(designGraph, projectGraph) {
        const planId = (0, uuid_1.v4)();
        const tasks = [];
        let order = 0;
        // Step 1: Find reusable widgets via semantic matching
        const matches = this.findMatches(designGraph, projectGraph);
        // Step 2: Identify missing components
        const { toCreate, toUpdate } = this.identifyGaps(designGraph, projectGraph, matches);
        // Step 3: Create tasks for reusable widgets
        for (const match of matches) {
            if (!match.needsModification) {
                tasks.push({
                    id: `task_${(0, uuid_1.v4)()}`,
                    type: 'reuse_widget',
                    priority: 'high',
                    order: order++,
                    title: `Reuse existing widget: ${match.existingWidgetId}`,
                    description: `Design component ${match.designComponentId} matches existing widget ${match.existingWidgetId} with ${Math.round(match.matchScore * 100)}% similarity`,
                    designNodeId: match.designComponentId,
                    existingWidgetId: match.existingWidgetId,
                    targetFilePath: '',
                    requiresManualReview: false,
                    dependencies: [],
                    status: 'pending',
                });
            }
            else {
                tasks.push({
                    id: `task_${(0, uuid_1.v4)()}`,
                    type: 'update_widget',
                    priority: 'high',
                    order: order++,
                    title: `Update widget to match design: ${match.existingWidgetId}`,
                    description: `Widget ${match.existingWidgetId} needs modifications to match design component ${match.designComponentId}`,
                    designNodeId: match.designComponentId,
                    existingWidgetId: match.existingWidgetId,
                    targetFilePath: '',
                    requiresManualReview: true,
                    dependencies: [],
                    status: 'pending',
                });
            }
        }
        // Step 4: Create tasks for new widgets
        for (const item of toCreate) {
            tasks.push({
                id: `task_${(0, uuid_1.v4)()}`,
                type: 'create_widget',
                priority: 'high',
                order: order++,
                title: `Create new widget: ${item.name}`,
                description: `Design component requires a new widget at ${item.suggestedPath}`,
                designNodeId: item.designNodeId,
                targetFilePath: item.suggestedPath,
                requiresManualReview: false,
                dependencies: [],
                status: 'pending',
            });
        }
        // Step 5: Create tasks for updates to existing files
        for (const item of toUpdate) {
            tasks.push({
                id: `task_${(0, uuid_1.v4)()}`,
                type: 'update_widget',
                priority: 'medium',
                order: order++,
                title: `Update file: ${item.filePath}`,
                description: item.reason,
                targetFilePath: item.filePath,
                requiresManualReview: true,
                dependencies: [],
                status: 'pending',
            });
        }
        // Step 6: Sort by priority and order
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
        // Step 7: Set dependencies based on ordering
        for (let i = 1; i < tasks.length; i++) {
            if (tasks[i].type === 'create_widget') {
                const parentTaskIdx = tasks.findIndex(t => t.type === 'update_widget' && t.targetFilePath === tasks[i].targetFilePath);
                if (parentTaskIdx !== -1 && parentTaskIdx < i) {
                    tasks[i].dependencies.push(tasks[parentTaskIdx].id);
                }
            }
        }
        const filesToCreate = [...new Set(tasks.filter(t => t.type === 'create_widget').map(t => t.targetFilePath))];
        const filesToModify = [...new Set(tasks.filter(t => t.type !== 'reuse_widget' && !filesToCreate.includes(t.targetFilePath)).map(t => t.targetFilePath))];
        return {
            id: planId,
            designGraphId: designGraph.id,
            projectGraphId: projectGraph.id,
            createdAt: new Date().toISOString(),
            status: 'pending',
            totalTasks: tasks.length,
            completedTasks: 0,
            tasks,
            summary: {
                widgetsToCreate: toCreate.length,
                widgetsToUpdate: toUpdate.length,
                widgetsToReuse: matches.filter(m => !m.needsModification).length,
                filesToModify: filesToModify,
                filesToCreate: filesToCreate,
                routesToRegister: [],
                assetsToAdd: [],
            },
        };
    }
    findMatches(designGraph, projectGraph) {
        const matches = [];
        const visitedDesignComponents = new Set();
        // Collect all component names from pages
        for (const page of designGraph.pages) {
            this.collectComponentIds(page.children, visitedDesignComponents);
        }
        // Match against existing widgets using name similarity
        for (const designId of visitedDesignComponents) {
            const bestMatch = this.findBestMatch(designId, projectGraph.widgets);
            if (bestMatch) {
                matches.push(bestMatch);
            }
        }
        return matches;
    }
    collectComponentIds(nodes, visited) {
        for (const node of nodes) {
            if (!node)
                continue;
            if (node.type === 'component' || node.type === 'instance') {
                const name = this.normalizeName(node.name);
                if (name)
                    visited.add(name);
            }
            if (node.children) {
                this.collectComponentIds(node.children, visited);
            }
        }
    }
    normalizeName(name) {
        return name
            .replace(/[-_\s]+/g, '')
            .toLowerCase();
    }
    findBestMatch(designId, widgets) {
        const normalizedDesign = this.normalizeName(designId);
        let bestScore = 0;
        let bestWidgetId = null;
        for (const [widgetId, widget] of widgets.entries()) {
            const normalizedWidget = this.normalizeName(widget.name);
            // Calculate similarity score
            let score = 0;
            // Exact match
            if (normalizedDesign === normalizedWidget) {
                score = 1.0;
            }
            // Contains or is contained
            else if (normalizedDesign.includes(normalizedWidget) || normalizedWidget.includes(normalizedDesign)) {
                score = Math.min(normalizedWidget.length, normalizedDesign.length) / Math.max(normalizedWidget.length, normalizedDesign.length);
            }
            // Word overlap
            else {
                const designWords = new Set(normalizedDesign.split(/[_\-]/));
                const widgetWords = new Set(normalizedWidget.split(/[_\-]/));
                let matches = 0;
                for (const word of designWords) {
                    if (widgetWords.has(word))
                        matches++;
                }
                score = matches / Math.max(designWords.size, widgetWords.size);
            }
            if (score > bestScore && score >= 0.4) {
                bestScore = score;
                bestWidgetId = widgetId;
            }
        }
        if (!bestWidgetId)
            return null;
        const existingWidget = widgets.get(bestWidgetId);
        const needsModification = bestScore < 0.95;
        return {
            designComponentId: designId,
            existingWidgetId: bestWidgetId,
            matchScore: Math.round(bestScore * 100) / 100,
            matchReason: bestScore === 1 ? 'exact_match' : bestScore > 0.7 ? 'semantic_match' : 'structural_similarity',
            needsModification,
        };
    }
    identifyGaps(designGraph, projectGraph, matches) {
        const matchedIds = new Set(matches.map(m => m.designComponentId));
        const toCreate = [];
        const toUpdate = [];
        // Find components that need to be created
        for (const page of designGraph.pages) {
            this.collectAllComponentIds(page.children, matchedIds, toCreate);
        }
        return { toCreate, toUpdate };
    }
    collectAllComponentIds(nodes, visited, result) {
        for (const node of nodes) {
            if (!node || !node.id)
                continue;
            const normalized = this.normalizeName(node.name);
            if (node.type === 'component' || node.type === 'instance') {
                if (!visited.has(normalized)) {
                    result.push({
                        name: node.name,
                        suggestedPath: `lib/features/${normalized.toLowerCase()}/${normalized.toLowerCase()}_page.dart`,
                        designNodeId: node.id,
                    });
                    visited.add(normalized);
                }
            }
            if (node.children) {
                this.collectAllComponentIds(node.children, visited, result);
            }
        }
    }
}
exports.PlanningEngine = PlanningEngine;
//# sourceMappingURL=index.js.map