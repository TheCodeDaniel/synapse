/**
 * Planning Engine - Compares Design Graph with Project Graph and produces implementation plans.
 */

import { v4 as uuidv4 } from 'uuid';
import {
  DesignGraph,
  DesignNode,
  ProjectGraph,
  ImplementationPlan,
  Task,
  WidgetMatch,
  MatchReason,
} from '../types';
import { getChildNodes } from '../utils/design-node-traversal';

export class PlanningEngine {
  async compare(
    designGraph: DesignGraph,
    projectGraph: ProjectGraph
  ): Promise<ImplementationPlan> {
    const planId = uuidv4();
    const tasks: Task[] = [];
    let order = 0;

    // Step 1: Find reusable widgets via semantic matching
    const matches = this.findMatches(designGraph, projectGraph);

    // Step 2: Identify missing components
    const { toCreate, toUpdate } = this.identifyGaps(
      designGraph,
      projectGraph,
      matches
    );

    // Step 3: Create tasks for reusable widgets
    for (const match of matches) {
      if (!match.needsModification) {
        tasks.push({
          id: `task_${uuidv4()}`,
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
      } else {
        tasks.push({
          id: `task_${uuidv4()}`,
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
        id: `task_${uuidv4()}`,
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
        id: `task_${uuidv4()}`,
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

    // Step 6: Fold in repeated UI patterns that were hand-built instead of
    // formalized as a Figma component (from ComponentDiscoveryEngine).
    // Reuses the same name-similarity matcher as formal components, so a
    // discovered "ProductCard" pattern still gets reused/updated against an
    // existing widget rather than always creating a duplicate.
    for (const pattern of designGraph.discoveredPatterns ?? []) {
      const match = this.findBestMatch(pattern.suggestedName, projectGraph.widgets);

      if (match) {
        tasks.push({
          id: `task_${uuidv4()}`,
          type: match.needsModification ? 'update_widget' : 'reuse_widget',
          priority: 'medium',
          order: order++,
          title: `${match.needsModification ? 'Update' : 'Reuse'} widget for discovered pattern: ${pattern.suggestedName}`,
          description: `Design repeats this pattern ${pattern.occurrenceCount} times (not a formal Figma component) and matches existing widget ${match.existingWidgetId} with ${Math.round(match.matchScore * 100)}% similarity`,
          designNodeId: pattern.nodeIds[0],
          existingWidgetId: match.existingWidgetId,
          targetFilePath: '',
          requiresManualReview: match.needsModification,
          dependencies: [],
          status: 'pending',
        });
      } else {
        const normalized = this.normalizeName(pattern.suggestedName);
        tasks.push({
          id: `task_${uuidv4()}`,
          type: 'create_widget',
          priority: 'medium',
          order: order++,
          title: `Create new widget for discovered pattern: ${pattern.suggestedName}`,
          description: `Design repeats this pattern ${pattern.occurrenceCount} times across the file but it isn't a formal Figma component; extracting a reusable ${pattern.suggestedName} widget is recommended.`,
          designNodeId: pattern.nodeIds[0],
          targetFilePath: `lib/widgets/${normalized}.dart`,
          requiresManualReview: false,
          dependencies: [],
          status: 'pending',
        });
      }
    }

    // Step 7: Sort by priority and order
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    tasks.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    // Step 8: Set dependencies based on ordering
    for (let i = 1; i < tasks.length; i++) {
      if (tasks[i].type === 'create_widget') {
        const parentTaskIdx = tasks.findIndex(
          t => t.type === 'update_widget' && t.targetFilePath === tasks[i].targetFilePath
        );
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
        // Derived from the final task list (rather than only `toCreate`/
        // `matches`) so discovered-pattern tasks are reflected too.
        widgetsToCreate: tasks.filter(t => t.type === 'create_widget').length,
        widgetsToUpdate: tasks.filter(t => t.type === 'update_widget').length,
        widgetsToReuse: tasks.filter(t => t.type === 'reuse_widget').length,
        filesToModify: filesToModify,
        filesToCreate: filesToCreate,
        routesToRegister: [],
        assetsToAdd: [],
      },
    };
  }

  private findMatches(
    designGraph: DesignGraph,
    projectGraph: ProjectGraph
  ): WidgetMatch[] {
    const matches: WidgetMatch[] = [];
    const visitedDesignComponents = new Set<string>();

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

  private collectComponentIds(
    nodes: DesignNode[],
    visited: Set<string>
  ): void {
    for (const node of nodes) {
      if (!node) continue;
      if (node.type === 'component' || node.type === 'instance') {
        const name = this.normalizeName(node.name);
        if (name) visited.add(name);
      }
      this.collectComponentIds(getChildNodes(node), visited);
    }
  }

  private normalizeName(name: string): string {
    return name
      .replace(/[-_\s]+/g, '')
      .toLowerCase();
  }

  private findBestMatch(
    designId: string,
    widgets: Map<string, any>
  ): WidgetMatch | null {
    const normalizedDesign = this.normalizeName(designId);
    let bestScore = 0;
    let bestWidgetId: string | null = null;

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
          if (widgetWords.has(word)) matches++;
        }
        score = matches / Math.max(designWords.size, widgetWords.size);
      }

      if (score > bestScore && score >= 0.4) {
        bestScore = score;
        bestWidgetId = widgetId;
      }
    }

    if (!bestWidgetId) return null;

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

  private identifyGaps(
    designGraph: DesignGraph,
    projectGraph: ProjectGraph,
    matches: WidgetMatch[]
  ): { toCreate: Array<{ name: string; suggestedPath: string; designNodeId: string }>; toUpdate: Array<{ filePath: string; reason: string }> } {
    const matchedIds = new Set(matches.map(m => m.designComponentId));
    const toCreate: Array<{ name: string; suggestedPath: string; designNodeId: string }> = [];
    const toUpdate: Array<{ filePath: string; reason: string }> = [];

    // Find components that need to be created
    for (const page of designGraph.pages) {
      this.collectAllComponentIds(page.children, matchedIds, toCreate);
    }

    return { toCreate, toUpdate };
  }

  private collectAllComponentIds(
    nodes: DesignNode[],
    visited: Set<string>,
    result: Array<{ name: string; suggestedPath: string; designNodeId: string }>
  ): void {
    for (const node of nodes) {
      if (!node || !('id' in node)) continue;

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

      this.collectAllComponentIds(getChildNodes(node), visited, result);
    }
  }
}