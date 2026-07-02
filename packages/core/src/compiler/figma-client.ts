/**
 * Figma API client for fetching design file data.
 */

import axios, { AxiosInstance } from 'axios';
import { Cache } from '../utils/cache';
import { Logger } from '../utils/logger';

export interface FigmaFileResponse {
  doc: DocumentNode;
  name: string;
  lastModified: string;
  editorType: 'FIGMA' | 'DESKTOP' | 'SKETCH';
  projectMode: boolean;
}

export interface FigmaComponentResponse {
  id: string;
  name: string;
  description: string;
  componentSetId: string | null;
  createdAt: string;
  lastModified: string;
  hiddenFromScenarios?: boolean;
}

export interface FigmaVariableResponse {
  key: string;
  name: string;
  variableCollectionId: string;
  resolvedType: 'STRING' | 'BOOLEAN' | 'NUMBER' | 'COLOR';
  valuesByMode: Record<string, string | number | [number, number, number, number]>;
  mode: string;
}

export interface FigmaVariableCollectionResponse {
  id: string;
  name: string;
  modes: Array<{ name: string; variableIds: string[] }>;
}

export interface DocumentNode {
  document: {
    id: string;
    name: string;
    type: 'DOCUMENT';
    children: FigmaPageNode[];
  };
}

export interface FigmaPageNode {
  id: string;
  name: string;
  type: 'CANVAS' | 'PAGE';
  children: FigmaFrameNode[];
}

export interface FigmaFrameNode {
  id: string;
  name: string;
  type: 'FRAME' | 'GROUP' | 'COMPONENT' | 'COMPONENT_SET' | 'INSTANCE' | 'TEXT' | 'RECTANGLE' | 'ELLIPSE' | 'LINE' | 'VECTOR' | 'BOOLEAN_GROUP' | 'STAR' | 'SECTION';
  x: number;
  y: number;
  width: number;
  height: number;
  layoutMode?: 'HORIZONTAL' | 'VERTICAL' | 'NONE';
  primaryAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  counterAxisAlignItems?: 'MIN' | 'CENTER' | 'MAX' | 'SPACE_BETWEEN';
  itemSpacing?: number;
  paddingLeft?: number;
  paddingRight?: number;
  paddingTop?: number;
  paddingBottom?: number;
  primaryAxisSpacing?: number;
  counterAxisSpacing?: number;
  constraints?: { type: string; value: string };
  clipsContent?: boolean;
  backgroundColor?: string | null;
  borderRadius?: number;
  cornerRadius?: [number, number, number, number];
  children?: FigmaFrameNode[];
  style?: FigmaStyle;
  effects?: FigmaEffect[];
  fills?: FigmaPaint[];
  strokes?: FigmaPaint[];
}

export interface FigmaStyle {
  fills: FigmaPaint[];
  strokes: FigmaPaint[];
  strokeWeight: number;
  strokeAlign: 'INSIDE' | 'OUTSIDE' | 'CENTER';
  backgrounds?: FigmaPaint[];
  effects: FigmaEffect[];
  gridStyles: FigmaGridStyle[];
}

export interface FigmaPaint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE';
  visible?: boolean;
  opacity?: number;
  color?: { r: number; g: number; b: number; a: number };
  gradientHandlePositions?: Array<{ x: number; y: number }>;
}

export interface FigmaEffect {
  type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
  visible: boolean;
  radius: number;
  color?: { r: number; g: number; b: number; a: number };
  offset?: { x: number; y: number };
  spread?: number;
  inner: boolean;
}

export interface FigmaGridStyle {
  pattern: 'COLUMNS' | 'ROWS' | 'GRID';
  sectionSize: number;
  visible?: boolean;
  stiffness?: number;
}

export interface TextStyle {
  fontFamily: string;
  fontPostScriptName?: string;
  fontWeight: number;
  fontSize: number;
  textAlignHorizontal: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
  textAlignVertical: 'TOP' | 'CENTER' | 'BOTTOM';
  letterSpacing: number;
  lineHeightPx?: number;
  textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
}

export interface FigmaTextStyle {
  fontFamily: string;
  fontPostScriptName?: string;
  fontWeight: number;
  fontSize: number;
  textAlignHorizontal: string;
  textAlignVertical: string;
  letterSpacing: number;
  lineHeightPx?: number;
}

type NodeWithStyle = FigmaFrameNode & { style: FigmaStyle };

export class FigmaClient {
  private axiosInstance: AxiosInstance;
  private cache: Cache | null;
  private logger: Logger;

  constructor(accessToken: string, cache: Cache | null, logger: Logger) {
    this.axiosInstance = axios.create({
      baseURL: 'https://api.figma.com/v1',
      headers: { 'X-Figma-Token': accessToken },
    });
    this.cache = cache;
    this.logger = logger;
  }

  async getFile(fileKey: string, depth?: number): Promise<FigmaFileResponse> {
    const cacheKey = `figma_file_${fileKey}`;

    if (this.cache?.has(cacheKey)) {
      this.logger.debug(`Cache hit for Figma file: ${fileKey}`);
      return this.cache.get<FigmaFileResponse>(cacheKey)!;
    }

    try {
      const params = new URLSearchParams();
      if (depth) params.set('geometry', 'paths');
      if (depth) params.set('depth', String(depth));

      const endpoint = depth ? `/files/${fileKey}?geometry=paths&depth=${depth}` : `/files/${fileKey}`;
      const response = await this.axiosInstance.get(endpoint);
      const data = response.data as FigmaFileResponse;

      if (this.cache) {
        this.cache.set(cacheKey, data);
      }

      return data;
    } catch (error: unknown) {
      const message = axios.isAxiosError(error) ? `Figma API error: ${error.response?.data?.message ?? error.message}` : String(error);
      this.logger.error(`Failed to fetch Figma file: ${fileKey}`, message);
      throw new Error(message);
    }
  }

  async getComponents(fileKey: string, componentIds: string[]): Promise<FigmaComponentResponse[]> {
    if (componentIds.length === 0) return [];

    const cacheKey = `figma_components_${componentIds.join(',')}`;

    if (this.cache?.has(cacheKey)) {
      this.logger.debug(`Cache hit for components`);
      return this.cache.get<FigmaComponentResponse[]>(cacheKey)!;
    }

    try {
      const idsParam = componentIds.join(',');
      const response = await this.axiosInstance.get(`/components?ids=${idsParam}`);
      const data = response.data as { components: FigmaComponentResponse[] };

      if (this.cache) {
        this.cache.set(cacheKey, data.components);
      }

      return data.components;
    } catch (error) {
      this.logger.error(`Failed to fetch components`, error);
      return [];
    }
  }

  async getVariables(fileKey: string): Promise<{
    variableCollections: Record<string, FigmaVariableCollectionResponse>;
    variables: Record<string, FigmaVariableResponse>;
  }> {
    try {
      const response = await this.axiosInstance.get(`/files/${fileKey}/variables/local`);
      return response.data as {
        variableCollections: Record<string, FigmaVariableCollectionResponse>;
        variables: Record<string, FigmaVariableResponse>;
      };
    } catch (error) {
      this.logger.error(`Failed to fetch variables`, error);
      return { variableCollections: {}, variables: {} };
    }
  }

  async getImage(fileKey: string, nodeIds: string, format: 'png' | 'svg' | 'jpg' = 'png', scale: number = 2): Promise<string> {
    const idsParam = encodeURIComponent(nodeIds);
    const endpoint = `/images/${fileKey}?ids=${idsParam}&format=${format}&scale=${scale}`;

    try {
      const response = await this.axiosInstance.get(endpoint);
      return response.data.images[0] as string;
    } catch (error) {
      this.logger.error(`Failed to fetch image for nodes: ${nodeIds}`, error);
      throw new Error(`Figma image API error`);
    }
  }

  invalidateCache(fileKey: string): void {
    if (!this.cache) return;

    const prefix = `figma_${fileKey}`;
    // Clear all known cache patterns for this file
    this.cache.delete(`${prefix}`);
  }
}