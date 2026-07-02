/**
 * Figma API client for fetching design file data.
 */
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
    modes: Array<{
        name: string;
        variableIds: string[];
    }>;
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
    constraints?: {
        type: string;
        value: string;
    };
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
    color?: {
        r: number;
        g: number;
        b: number;
        a: number;
    };
    gradientHandlePositions?: Array<{
        x: number;
        y: number;
    }>;
}
export interface FigmaEffect {
    type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
    visible: boolean;
    radius: number;
    color?: {
        r: number;
        g: number;
        b: number;
        a: number;
    };
    offset?: {
        x: number;
        y: number;
    };
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
export declare class FigmaClient {
    private axiosInstance;
    private cache;
    private logger;
    constructor(accessToken: string, cache: Cache | null, logger: Logger);
    getFile(fileKey: string, depth?: number): Promise<FigmaFileResponse>;
    getComponents(fileKey: string, componentIds: string[]): Promise<FigmaComponentResponse[]>;
    getVariables(fileKey: string): Promise<{
        variableCollections: Record<string, FigmaVariableCollectionResponse>;
        variables: Record<string, FigmaVariableResponse>;
    }>;
    getImage(fileKey: string, nodeIds: string, format?: 'png' | 'svg' | 'jpg', scale?: number): Promise<string>;
    invalidateCache(fileKey: string): void;
}
//# sourceMappingURL=figma-client.d.ts.map