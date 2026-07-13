/**
 * Design Compiler - Compiles Figma file data into a normalized Design Graph.
 */

import { FigmaClient, FigmaFrameNode, FigmaPaint, FigmaEffect, FigmaVariableResponse, FigmaVariableCollectionResponse } from './figma-client';
import {
  DesignGraph,
  DesignPage,
  DesignNode,
  FrameNode,
  ComponentNode,
  VariantNode,
  VariantProperty,
  InstanceNode,
  TextNode,
  TextStyle,
  ShapeNode,
  GroupNode,
  ColorValue,
  Paint,
  Effect,
  StyleReference,
  FigmaComponent,
  AssetRegistry,
  VariableRegistry,
  DesignTokenRegistry,
  ColorToken,
  SpacingToken,
  TypographyToken,
  ShadowToken,
  RadiusToken,
  BreakpointToken,
} from '../types';

interface VariableData {
  variableCollections: Record<string, FigmaVariableCollectionResponse>;
  variables: Record<string, FigmaVariableResponse>;
}

export class DesignCompiler {
  private client: FigmaClient;
  private colorCache = new Map<string, string>();
  private componentMap = new Map<string, FigmaComponent>();

  constructor(client: FigmaClient) {
    this.client = client;
  }

  async compile(fileKey: string): Promise<DesignGraph> {
    const fileData = await this.client.getFile(fileKey, 10);
    const variableData = await this.client.getVariables(fileKey);

    const pages: DesignPage[] = [];
    const components = new Map<string, FigmaComponent>();
    const variables: VariableRegistry = { colors: new Map(), scalars: new Map(), strings: new Map(), boolean: new Map(), composite: new Map() };
    const designTokens = this.extractDesignTokens(variableData);
    const assets: AssetRegistry = { images: new Map(), svgs: new Map(), others: new Map() };

    for (const pageNode of fileData.document.children) {
      if (pageNode.type === 'CANVAS' || pageNode.type === 'PAGE') {
        const page: DesignPage = {
          id: pageNode.id,
          name: pageNode.name,
          type: 'page',
          children: this.compileNodes(pageNode.children ?? []),
          order: pages.length,
        };
        pages.push(page);
      }
    }

    for (const [compId, comp] of this.componentMap.entries()) {
      components.set(compId, comp);
    }

    return {
      id: fileKey,
      version: '1.0.0',
      figmaFileKey: fileKey,
      fileName: fileData.name || fileKey,
      importedAt: new Date().toISOString(),
      updatedAt: new Date(fileData.lastModified).toISOString(),
      pages,
      components,
      variables,
      designTokens,
      assets,
    };
  }

  private compileNodes(nodes: FigmaFrameNode[]): DesignNode[] {
    const compiled: DesignNode[] = [];
    for (const node of nodes) {
      const result = this.compileNode(node);
      if (result) compiled.push(result);
    }
    return compiled;
  }

  private compileNode(node: FigmaFrameNode): DesignNode | null {
    switch (node.type) {
      case 'FRAME':
        return this.compileFrame(node);
      case 'COMPONENT':
        return this.compileComponent(node);
      case 'COMPONENT_SET':
        return this.compileComponentSet(node);
      case 'INSTANCE':
        return this.compileInstance(node);
      case 'TEXT':
        return this.compileText(node);
      case 'RECTANGLE':
      case 'ELLIPSE':
      case 'VECTOR':
      case 'LINE':
      case 'STAR':
        return this.compileShape(node);
      case 'GROUP':
      case 'BOOLEAN_GROUP':
        return this.compileGroup(node);
      case 'SECTION':
        return this.compileSection(node);
      default:
        return null;
    }
  }

  private compileFrame(node: FigmaFrameNode): FrameNode {
    const fills = node.fills ?? [];
    const bgColor = this.extractColor(fills);

    return {
      type: 'frame',
      id: node.id,
      name: node.name,
      typeName: node.type,
      x: node.x,
      y: node.y,
      width: node.width,
      height: node.height,
      paddingLeft: node.paddingLeft ?? 0,
      paddingRight: node.paddingRight ?? 0,
      paddingTop: node.paddingTop ?? 0,
      paddingBottom: node.paddingBottom ?? 0,
      itemCount: node.children?.length ?? 0,
      layoutMode: this.mapLayoutMode(node.layoutMode),
      primaryAxisAlignItems: this.mapAlignment(node.primaryAxisAlignItems),
      counterAxisAlignItems: this.mapAlignment(node.counterAxisAlignItems),
      primaryAxisSpacing: node.primaryAxisSpacing ?? 0,
      counterAxisSpacing: node.counterAxisSpacing ?? 0,
      constraints: { vertical: 'stretch', horizontal: 'stretch' },
      clipsContent: node.clipsContent ?? false,
      backgroundColor: bgColor,
      borderRadius: this.mapBorderRadius(node),
      children: this.compileNodes(node.children ?? []),
      style: this.compileStyle(node),
      attributes: {},
      codeExtensions: [],
    };
  }

  private compileComponent(node: FigmaFrameNode): ComponentNode {
    const component: FigmaComponent = {
      id: node.id,
      name: node.name,
      description: '',
      type: 'component',
      variants: new Map(),
      defaultVariant: null,
      properties: [],
      exports: [],
      createdAt: '',
      updatedAt: new Date().toISOString(),
    };

    this.componentMap.set(node.id, component);

    return {
      type: 'component',
      id: node.id,
      name: node.name,
      description: component.description,
      variants: [],
      overrides: [],
      style: this.compileStyle(node),
      attributes: {},
      codeExtensions: [],
    };
  }

  private compileComponentSet(node: FigmaFrameNode): ComponentNode {
    const variantChildren = node.children ?? [];
    const variantsMap = new Map<string, VariantNode>();
    const variants: VariantNode[] = [];

    for (const child of variantChildren) {
      if (child.type !== 'COMPONENT') continue;

      const variant: VariantNode = {
        type: 'variant',
        id: child.id,
        name: child.name,
        properties: this.parseVariantProperties(child.name),
        children: this.compileNodes(child.children ?? []),
        style: this.compileStyle(child),
        constraints: { vertical: 'stretch', horizontal: 'stretch' },
        borderRadius: this.mapBorderRadius(child),
        backgroundColor: this.extractColor(child.fills ?? []),
      };

      variantsMap.set(child.id, variant);
      variants.push(variant);
    }

    const component: FigmaComponent = {
      id: node.id,
      name: node.name,
      description: '',
      type: 'component_set',
      variants: variantsMap,
      defaultVariant: variants[0]?.id ?? null,
      properties: [],
      exports: [],
      createdAt: '',
      updatedAt: new Date().toISOString(),
    };

    this.componentMap.set(node.id, component);

    return {
      type: 'component',
      id: node.id,
      name: node.name,
      description: component.description,
      variants,
      overrides: [],
      style: this.compileStyle(node),
      attributes: {},
      codeExtensions: [],
    };
  }

  /** Parses Figma's `"Prop1=Value1, Prop2=Value2"` variant-child naming convention. */
  private parseVariantProperties(variantName: string): VariantProperty[] {
    return variantName
      .split(',')
      .map(part => part.trim())
      .filter(Boolean)
      .map(part => {
        const [name, value] = part.split('=').map(s => s.trim());
        return { name: name ?? part, value: value ?? '' };
      });
  }

  private compileInstance(node: FigmaFrameNode): InstanceNode {
    const componentId = node.id.replace(/:[0-9]+/i, '').split('/')[0];

    return {
      type: 'instance',
      id: node.id,
      name: node.name,
      componentId,
      children: this.compileNodes(node.children ?? []),
      overrides: [],
      style: this.compileStyle(node),
      constraints: { vertical: 'stretch', horizontal: 'stretch' },
      borderRadius: this.mapBorderRadius(node),
      backgroundColor: this.extractColor(node.fills ?? []),
    };
  }

  private compileText(node: FigmaFrameNode): TextNode {
    return {
      type: 'text',
      id: node.id,
      name: node.name,
      characters: node.characters ?? '',
      style: this.compileTextStyle(node),
    };
  }

  private compileShape(node: FigmaFrameNode): ShapeNode {
    return {
      type: 'shape',
      id: node.id,
      name: node.name,
      geometry: { path: '', winding: 'nonZero' },
      style: this.compileStyle(node),
      constraints: { vertical: 'stretch', horizontal: 'stretch' },
      borderRadius: this.mapBorderRadius(node),
      backgroundColor: this.extractColor(node.fills ?? []),
    };
  }

  private compileGroup(node: FigmaFrameNode): GroupNode {
    return {
      type: 'group',
      id: node.id,
      name: node.name,
      children: this.compileNodes(node.children ?? []),
      style: this.compileStyle(node),
      constraints: { vertical: 'stretch', horizontal: 'stretch' },
    };
  }

  private compileSection(node: FigmaFrameNode): FrameNode {
    return this.compileFrame(node);
  }

  private compileStyle(node: FigmaFrameNode): StyleReference {
    const fills = node.fills ?? [];
    const strokes = node.strokes ?? [];
    const effects = node.effects ?? [];

    return {
      fills: this.mapFills(fills),
      strokes: this.mapStrokes(strokes),
      strokeWeight: strokes.length > 0 && strokes[0].visible !== false ? node.strokeWeight ?? 1 : 0,
      strokeAlign: 'center',
      backgrounds: this.mapFills(fills.filter(f => f.type === 'SOLID')),
      effectSchedules: [],
      effects: this.mapEffects(effects),
      gridStyles: [],
    };
  }

  private compileTextStyle(node: FigmaFrameNode): TextStyle {
    const s = node.style;
    return {
      fontFamily: s?.fontFamily || 'Inter',
      fontPostScriptName: s?.fontPostScriptName,
      fontWeight: s?.fontWeight || 400,
      fontSize: s?.fontSize || 16,
      textAlignHorizontal: this.mapTextAlignHorizontal(s?.textAlignHorizontal),
      textAlignVertical: this.mapTextAlignVertical(s?.textAlignVertical),
      letterSpacing: s?.letterSpacing || 0,
      lineHeightPx: s?.lineHeightPx,
      lineHeightPercent: s?.lineHeightPercent,
      lineHeightUnit: 'PIXELS',
      textDecoration: this.mapTextDecoration(s?.textDecoration),
      listBulletIndent: 0,
    };
  }

  private mapFills(paints: FigmaPaint[]): Paint[] {
    const result: Paint[] = [];
    for (const p of paints) {
      if (p.visible === false) continue;
      if (p.type === 'SOLID' && p.color) {
        result.push({ type: 'SOLID', color: this.normalizeColor(p.color), opacity: p.opacity ?? 1 });
      } else if (p.type === 'GRADIENT_LINEAR') {
        result.push({
          type: 'GRADIENT_LINEAR',
          gradientStops: (p.gradientStops ?? []).map(stop => ({ position: stop.position, color: this.normalizeColor(stop.color) })),
          opacity: p.opacity ?? 1,
        });
      }
    }
    return result;
  }

  private mapStrokes(paints: FigmaPaint[]): Paint[] {
    return paints
      .filter(p => p.visible !== false && p.type === 'SOLID' && p.color)
      .map(p => ({ type: 'SOLID' as const, color: this.normalizeColor(p.color!), opacity: p.opacity ?? 1 }));
  }

  private mapEffects(effects: FigmaEffect[]): Effect[] {
    return effects
      .filter(e => e.visible !== false)
      .map(e => ({
        type: e.type,
        visible: e.visible,
        radius: e.radius,
        color: e.color ? this.normalizeColor(e.color) : { r: 0, g: 0, b: 0, a: 0.25 },
        offset: e.offset ?? { x: 0, y: 4 },
        spread: e.spread ?? 0,
        inner: e.inner || false,
      }));
  }

  private extractColor(paints: FigmaPaint[]): ColorValue | null {
    for (const paint of paints) {
      if (paint.type === 'SOLID' && paint.visible !== false && paint.color) {
        return this.normalizeColor(paint.color);
      }
    }
    return null;
  }

  private normalizeColor(color: { r: number; g: number; b: number; a: number }): ColorValue {
    const key = `${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)},${color.a}`;

    if (!this.colorCache.has(key)) {
      this.colorCache.set(key, `rgba(${Math.round(color.r * 255)}, ${Math.round(color.g * 255)}, ${Math.round(color.b * 255)}, ${color.a})`);
    }

    return { r: color.r, g: color.g, b: color.b, a: color.a };
  }

  private mapBorderRadius(node: FigmaFrameNode): { topLeft: number; topRight: number; bottomLeft: number; bottomRight: number } {
    if (node.rectangleCornerRadii) {
      const [topLeft, topRight, bottomRight, bottomLeft] = node.rectangleCornerRadii;
      return { topLeft, topRight, bottomLeft, bottomRight };
    }
    const uniform = node.cornerRadius ?? 0;
    return { topLeft: uniform, topRight: uniform, bottomLeft: uniform, bottomRight: uniform };
  }

  private mapLayoutMode(mode?: string): 'none' | 'horizontal' | 'vertical' {
    switch (mode) {
      case 'HORIZONTAL': return 'horizontal';
      case 'VERTICAL': return 'vertical';
      default: return 'none';
    }
  }

  private mapAlignment(align?: string): 'min' | 'center' | 'max' | 'space-between' {
    const mapping: Record<string, 'min' | 'center' | 'max' | 'space-between'> = {
      MIN: 'min',
      CENTER: 'center',
      MAX: 'max',
      SPACE_BETWEEN: 'space-between',
    };
    return mapping[align ?? ''] ?? 'min';
  }

  private mapTextAlignHorizontal(align?: string): 'left' | 'center' | 'right' | 'justify' {
    const mapping: Record<string, 'left' | 'center' | 'right' | 'justify'> = {
      LEFT: 'left',
      CENTER: 'center',
      RIGHT: 'right',
      JUSTIFIED: 'justify',
    };
    return mapping[align ?? ''] ?? 'left';
  }

  private mapTextAlignVertical(align?: string): 'top' | 'center' | 'bottom' {
    const mapping: Record<string, 'top' | 'center' | 'bottom'> = {
      TOP: 'top',
      CENTER: 'center',
      BOTTOM: 'bottom',
    };
    return mapping[align ?? ''] ?? 'top';
  }

  private mapTextDecoration(decoration?: string): 'none' | 'underline' | 'strikethrough' {
    const mapping: Record<string, 'none' | 'underline' | 'strikethrough'> = {
      NONE: 'none',
      UNDERLINE: 'underline',
      STRIKETHROUGH: 'strikethrough',
    };
    return mapping[decoration ?? ''] ?? 'none';
  }

  private extractDesignTokens(variableData: VariableData): DesignTokenRegistry {
    const colors: ColorToken[] = [];
    const spacing: SpacingToken[] = [];
    const typography: TypographyToken[] = [];
    const shadows: ShadowToken[] = [];
    const radii: RadiusToken[] = [];
    const breakpoints: BreakpointToken[] = [];

    for (const v of Object.values(variableData.variables ?? {})) {
      if (v.resolvedType !== 'COLOR') continue;

      const value = Object.values(v.valuesByMode)[0];
      if (!Array.isArray(value) || value.length !== 4) continue;

      const [r, g, b, a] = value;
      colors.push({ name: v.name, value: { r, g, b, a }, type: 'color' });
    }

    return { colors, spacing, typography, breakpoints, shadows, borders: [], opacity: [], radii, zIndices: [] };
  }
}
