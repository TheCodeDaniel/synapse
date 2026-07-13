/**
 * Design Compiler - Compiles Figma file data into a normalized Design Graph.
 */
import { FigmaClient } from './figma-client';
import { DesignGraph } from '../types';
export declare class DesignCompiler {
    private client;
    private colorCache;
    private componentMap;
    constructor(client: FigmaClient);
    compile(fileKey: string): Promise<DesignGraph>;
    private compileNodes;
    private compileNode;
    private compileFrame;
    private compileComponent;
    private compileComponentSet;
    /** Parses Figma's `"Prop1=Value1, Prop2=Value2"` variant-child naming convention. */
    private parseVariantProperties;
    private compileInstance;
    private compileText;
    private compileShape;
    private compileGroup;
    private compileSection;
    private compileStyle;
    private compileTextStyle;
    private mapFills;
    private mapStrokes;
    private mapEffects;
    private extractColor;
    private normalizeColor;
    private mapBorderRadius;
    private mapLayoutMode;
    private mapAlignment;
    private mapTextAlignHorizontal;
    private mapTextAlignVertical;
    private mapTextDecoration;
    private extractDesignTokens;
}
//# sourceMappingURL=design-compiler.d.ts.map