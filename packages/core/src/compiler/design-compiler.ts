/**
 * Design Compiler - Compiles Figma file data into a normalized Design Graph.
 */

import { FigmaClient, FigmaFrameNode, FigmaPaint, FigmaEffect } from './figma-client';
import {
  DesignGraph,
  DesignPage,
  FrameNode,
  ComponentNode,
  VariantNode,
  InstanceNode,
  TextNode,
  ShapeNode,
  GroupNode,
  ColorValue,
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

export class DesignCompiler {
  private client: FigmaClient;
  private colorCache = new Map<string, string>();
  private componentMap = new Map<string, FigmaComponent>();

  constructor(client: FigmaClient) {
    this.client = client;
  }

  async compile(fileKey: string): Promise<DesignGraph> {
    const startTime = Date.now();

    const fileData = await this.client.getFile(fileKey, 10);
    const variableData = await this.client.getVariables(fileKey);

    const pages: DesignPage[] = [];
    const components = new Map<string, FigmaComponent>();
    const variables: VariableRegistry = { colors: new Map(), scalars: new Map(), strings: new Map(), boolean: new Map(), composite: new Map() };
    const designTokens = this.extractDesignTokens(variableData);
    const assets: AssetRegistry = { images: new Map(), svgs: new Map(), others: new Map() };

    for (const pageNode of (fileData.doc as any).children) {
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

  private compileNodes(nodes: FigmaFrameNode[]): any[] {
    return nodes.map(node => this.compileNode(node));
  }

  private compileNode(node: FigmaFrameNode): any {
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
      borderRadius: node.cornerRadius
        ? { topLeft: node.cornerRadius[0], topRight: node.cornerRadius[1], bottomLeft: node.cornerRadius[2], bottomRight: node.cornerRadius[3] }
        : { topLeft: node.borderRadius || 0, topRight: node.borderRadius || 0, bottomLeft: node.borderRadius || 0, bottomRight: node.borderRadius || 0 },
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
    const component: FigmaComponent = {
      id: node.id,
      name: node.name,
      description: '',
      type: 'component_set',
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
      borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 },
      backgroundColor: null,
    };
  }

  private compileText(node: FigmaFrameNode): TextNode {
    return {
      type: 'text',
      id: node.id,
      name: node.name,
      characters: '', // Figma API doesn't always include text content in the basic response
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
      borderRadius: { topLeft: 0, topRight: 0, bottomLeft: 0, bottomRight: 0 },
      backgroundColor: null,
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

  private compileStyle(node: FigmaFrameNode): any {
    const fills = node.fills ?? [];
    const strokes = node.strokes ?? [];
    const effects = node.effects ?? [];

    return {
      fills: this.mapFills(fills),
      strokes: this.mapStrokes(strokes),
      strokeWeight: strokes.length > 0 && strokes[0].visible !== false ? (node as any).style?.strokeWeight ?? 1 : 0,
      strokeAlign: 'center',
      backgrounds: this.mapFills(fills.filter(f => f.type === 'SOLID')),
      effectSchedules: {},
      effects: this.mapEffects(effects),
      gridStyles: [],
    };
  }

  private compileTextStyle(node: FigmaFrameNode): any {
    const textStyle = (node as any).style?.typography ?? {};
    return {
      fontFamily: textStyle.fontFamily || 'Inter',
      fontPostScriptName: textStyle.fontPostScriptName,
      fontWeight: textStyle.fontWeight || 400,
      fontSize: textStyle.fontSize || 16,
      textAlignHorizontal: (textStyle.textAlignHorizontal ?? 'LEFT') as any,
      textAlignVertical: (textStyle.textAlignVertical ?? 'TOP') as any,
      letterSpacing: textStyle.letterSpacing || 0,
      lineHeightPx: textStyle.lineHeightPx,
      lineHeightPercent: textStyle.lineHeightPercent,
      lineHeightUnit: 'PIXELS',
      textDecoration: (textStyle.textDecoration ?? 'NONE') as any,
    };
  }

  private mapFills(paints: FigmaPaint[]): any[] {
    return paints
      .filter(p => p.visible !== false)
      .map(p => {
        if (p.type === 'SOLID' && p.color) {
          return { type: 'solid', color: this.normalizeColor(p.color), opacity: p.opacity ?? 1 };
        }
        if (p.type === 'GRADIENT_LINEAR') {
          return { type: 'gradient_linear', gradientStops: (p as any).gradientStops ?? [], opacity: p.opacity ?? 1 };
        }
        return null;
      })
      .filter(Boolean);
  }

  private mapStrokes(paints: FigmaPaint[]): any[] {
    return paints
      .filter(p => p.visible !== false && p.type === 'SOLID' && p.color)
      .map(p => ({ type: 'solid', color: this.normalizeColor(p.color!), opacity: p.opacity ?? 1 }));
  }

  private mapEffects(effects: FigmaEffect[]): any[] {
    return effects
      .filter(e => e.visible !== false)
      .map(e => ({
        type: this.mapEffectType(e.type),
        radius: e.radius,
        color: e.color ? this.normalizeColor(e.color) : { r: 0, g: 0, b: 0, a: 0.25 },
        offset: e.offset ?? { x: 0, y: 4 },
        spread: e.spread ?? 0,
        inner: e.inner || false,
      }));
  }

  private mapEffectType(type: string): string {
    const mapping: Record<string, string> = {
      DROP_SHADOW: 'drop_shadow',
      INNER_SHADOW: 'inner_shadow',
      LAYER_BLUR: 'layer_blur',
      BACKGROUND_BLUR: 'background_blur',
    };
    return mapping[type] || type.toLowerCase();
  }

  private extractColor(paints: FigmaPaint[]): ColorValue | null {
    for (const paint of paints) {
      if (paint.type === 'SOLID' && paint.visible !== false && paint.color) {
        return this.normalizeColor(paint.color!);
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

  private extractDesignTokens(variableData: any): DesignTokenRegistry {
    const colors: ColorToken[] = [];
    const spacing: SpacingToken[] = [];
    const typography: TypographyToken[] = [];
    const shadows: ShadowToken[] = [];
    const radii: RadiusToken[] = [];
    const breakpoints: BreakpointToken[] = [];

    if (variableData.variables) {
      for (const entry of Object.values(variableData.variables)) {
        const v = entry as { resolvedType?: string; name?: string };
        if (v.resolvedType === 'COLOR') {
          colors.push({ name: v.name ?? 'unknown', value: { r: 1, g: 0, b: 0, a: 1 }, type: 'color' });
        }
      }
    }

    return { colors, spacing, typography, breakpoints, shadows, borders: [], opacity: [], radii, zIndices: [] };
  }
}
