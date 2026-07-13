/**
 * Figma API client for fetching design file data.
 */
import { Cache } from '../utils/cache';
import { Logger } from '../utils/logger';
/**
 * Shape of the Figma REST API's `GET /v1/files/:key` response.
 * The document tree lives at the top-level `document` field — there is no
 * `doc` wrapper in the real API.
 */
export interface FigmaFileResponse {
    document: DocumentNode;
    components: Record<string, FigmaComponentMetadata>;
    componentSets: Record<string, FigmaComponentMetadata>;
    schemaVersion: number;
    styles: Record<string, FigmaStyleMetadata>;
    name: string;
    lastModified: string;
    thumbnailUrl?: string;
    version: string;
    role: string;
    editorType: 'figma' | 'figjam';
    linkAccess: string;
}
export interface FigmaComponentMetadata {
    key: string;
    name: string;
    description: string;
    componentSetId?: string | null;
}
export interface FigmaStyleMetadata {
    key: string;
    name: string;
    styleType: 'FILL' | 'TEXT' | 'EFFECT' | 'GRID';
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
    valuesByMode: Record<string, string | number | boolean | [number, number, number, number]>;
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
    id: string;
    name: string;
    type: 'DOCUMENT';
    children: FigmaPageNode[];
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
    backgroundColor?: FigmaColor | null;
    /** Uniform corner radius, as returned by the real API (not a 4-tuple). */
    cornerRadius?: number;
    /** Per-corner radii [topLeft, topRight, bottomRight, bottomLeft], only present when corners differ. */
    rectangleCornerRadii?: [number, number, number, number];
    strokeWeight?: number;
    strokeAlign?: 'INSIDE' | 'OUTSIDE' | 'CENTER';
    children?: FigmaFrameNode[];
    /**
     * Only present on TEXT nodes. The Figma API calls this `TypeStyle` and it
     * carries font/typography data — it is NOT a paint/fill style (those live
     * in the top-level `fills`/`strokes`/`effects` fields on every node type).
     */
    style?: FigmaTextStyle;
    characters?: string;
    effects?: FigmaEffect[];
    fills?: FigmaPaint[];
    strokes?: FigmaPaint[];
}
export interface FigmaColor {
    r: number;
    g: number;
    b: number;
    a: number;
}
export interface FigmaPaint {
    type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE';
    visible?: boolean;
    opacity?: number;
    color?: FigmaColor;
    gradientHandlePositions?: Array<{
        x: number;
        y: number;
    }>;
    gradientStops?: FigmaGradientStop[];
}
export interface FigmaGradientStop {
    position: number;
    color: FigmaColor;
}
export interface FigmaEffect {
    type: 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';
    visible: boolean;
    radius: number;
    color?: FigmaColor;
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
export interface FigmaTextStyle {
    fontFamily: string;
    fontPostScriptName?: string;
    fontWeight: number;
    fontSize: number;
    textAlignHorizontal: 'LEFT' | 'CENTER' | 'RIGHT' | 'JUSTIFIED';
    textAlignVertical: 'TOP' | 'CENTER' | 'BOTTOM';
    letterSpacing: number;
    lineHeightPx?: number;
    lineHeightPercent?: number;
    textDecoration?: 'NONE' | 'UNDERLINE' | 'STRIKETHROUGH';
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
    /**
     * Extracts a safe, loggable message from a failed request. Never returns
     * the raw error object — Axios errors embed the full request config,
     * including the `X-Figma-Token` header, and must not be logged verbatim.
     */
    private describeError;
}
//# sourceMappingURL=figma-client.d.ts.map