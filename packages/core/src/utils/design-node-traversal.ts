import { DesignNode } from '../types/design.graph';

/**
 * Returns a node's children, uniformly across the DesignNode union.
 * `ComponentNode` has no top-level `children` field — its content lives
 * under `variants[].children` — so any caller that only checked `.children`
 * could never reach a component's actual design content.
 */
export function getChildNodes(node: DesignNode): DesignNode[] {
  switch (node.type) {
    case 'frame':
    case 'group':
    case 'instance':
    case 'variant':
    case 'document':
    case 'slice':
      return node.children;
    case 'component':
      return node.variants.flatMap(variant => variant.children);
    default:
      return [];
  }
}
