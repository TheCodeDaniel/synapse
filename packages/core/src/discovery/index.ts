/**
 * Component Discovery Engine - Detects UI patterns that were built by hand
 * multiple times instead of being formalized as a Figma component.
 *
 * Deterministic by design (matches the project's "AI is only used for
 * semantic matching, planning, and generation" principle): grouping is done
 * purely by structural shape, never by node name or text content, so
 * "Card 1" / "Card 2" / "ProductCard" are recognized as the same pattern
 * while genuinely different layouts never collide.
 */

import { DesignGraph, DesignNode, DiscoveredPattern, FrameNode, GroupNode } from '../types';
import { getChildNodes } from '../utils/design-node-traversal';

/** Tolerance window for width/height comparisons, so near-identical instances of the same pattern still match. */
const SIZE_BUCKET_PX = 20;

/** A pattern must repeat at least this many times to be worth surfacing. */
const MIN_OCCURRENCES = 2;

interface PatternGroup {
  nodeIds: string[];
  names: string[];
}

export class ComponentDiscoveryEngine {
  discover(designGraph: DesignGraph): DiscoveredPattern[] {
    const groups = new Map<string, PatternGroup>();

    for (const page of designGraph.pages) {
      this.walk(page.children, groups);
    }

    const patterns: DiscoveredPattern[] = [];
    for (const [fingerprint, group] of groups.entries()) {
      if (group.nodeIds.length < MIN_OCCURRENCES) continue;
      patterns.push({
        suggestedName: this.suggestName(group.names),
        occurrenceCount: group.nodeIds.length,
        nodeIds: group.nodeIds,
        fingerprint,
      });
    }

    return patterns.sort((a, b) => b.occurrenceCount - a.occurrenceCount);
  }

  private walk(nodes: DesignNode[], groups: Map<string, PatternGroup>): void {
    for (const node of nodes) {
      if (node.type === 'frame' || node.type === 'group') {
        const fingerprint = this.fingerprint(node);
        const group = groups.get(fingerprint) ?? { nodeIds: [], names: [] };
        group.nodeIds.push(node.id);
        group.names.push(node.name);
        groups.set(fingerprint, group);
      }
      this.walk(getChildNodes(node), groups);
    }
  }

  /**
   * A shallow structural signature: the node's own type/layout/size bucket,
   * plus its direct children's types (text children include font
   * size/weight so differently-worded-but-same-looking text still matches,
   * while differently-styled text does not). Intentionally shallow rather
   * than a full recursive subtree hash — cheap, deterministic, and good
   * enough to catch hand-duplicated components without false negatives from
   * minor nested differences.
   */
  private fingerprint(node: FrameNode | GroupNode): string {
    const childSignature = getChildNodes(node)
      .map(child => this.childSignature(child))
      .sort()
      .join(',');

    const shapeSignature =
      node.type === 'frame'
        ? `${this.bucket(node.width)}x${this.bucket(node.height)}:${node.layoutMode}`
        : 'group';

    return `${node.type}|${shapeSignature}|[${childSignature}]`;
  }

  private childSignature(node: DesignNode): string {
    if (node.type === 'text') {
      return `text:${node.style.fontSize}:${node.style.fontWeight}`;
    }
    return node.type;
  }

  private bucket(value: number): number {
    return Math.round(value / SIZE_BUCKET_PX) * SIZE_BUCKET_PX;
  }

  private suggestName(names: string[]): string {
    const prefix = this.longestCommonPrefix(names);
    const cleaned = prefix.replace(/[\s\d#._-]+$/g, '').trim();
    return this.toPascalCase(cleaned || names[0]);
  }

  private longestCommonPrefix(names: string[]): string {
    if (names.length === 0) return '';
    let prefix = names[0];
    for (const name of names.slice(1)) {
      while (prefix.length > 0 && !name.startsWith(prefix)) {
        prefix = prefix.slice(0, -1);
      }
    }
    return prefix;
  }

  private toPascalCase(value: string): string {
    const pascal = value
      .split(/[^a-zA-Z0-9]+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join('');
    return pascal || 'DiscoveredComponent';
  }
}
