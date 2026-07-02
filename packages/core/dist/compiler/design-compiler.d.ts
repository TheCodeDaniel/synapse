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
    private mapEffectType;
    private extractColor;
    private normalizeColor;
    private mapLayoutMode;
    private mapAlignment;
    private extractDesignTokens;
}
//# sourceMappingURL=design-compiler.d.ts.map