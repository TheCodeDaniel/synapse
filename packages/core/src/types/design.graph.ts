/**
 * Design Graph types - Framework-agnostic representation of Figma design files.
 * Represents pages, frames, components, variables, layouts, and prototype links.
 */

export interface DesignGraph {
  id: string;
  version: string;
  figmaFileKey: string;
  fileName: string;
  importedAt: string;
  updatedAt: string;
  pages: DesignPage[];
  components: Map<string, FigmaComponent>;
  variables: VariableRegistry;
  designTokens: DesignTokenRegistry;
  assets: AssetRegistry;
}

export interface FigmaComponent {
  id: string;
  name: string;
  description: string;
  type: 'component' | 'component_set';
  variants: Map<string, VariantNode>;
  defaultVariant: string | null;
  properties: ComponentProperty[];
  exports: ExportSetting[];
  createdAt: string;
  updatedAt: string;
}

export interface ComponentProperty {
  name: string;
  type: 'TEXT' | 'BOOLEAN' | 'INSTANCE_SWAP' | 'VARIANT';
  defaultValue: string | boolean;
  variantValues?: Record<string, string | boolean>;
}

export interface AssetRegistry {
  images: Map<string, ImageAsset>;
  svgs: Map<string, SVGAsset>;
  others: Map<string, OtherAsset>;
}

export interface ImageAsset {
  id: string;
  name: string;
  url: string;
  format: 'PNG' | 'JPEG';
  width: number;
  height: number;
  exportSettings: ExportSetting[];
}

export interface SVGAsset {
  id: string;
  name: string;
  content?: string;
  url: string;
  width: number;
  height: number;
}

export interface OtherAsset {
  id: string;
  name: string;
  type: string;
  url: string;
}

export interface DesignPage {
  id: string;
  name: string;
  type: 'page';
  children: DesignNode[];
  order: number;
}

export type DesignNode =
  | DocumentNode
  | FrameNode
  | ComponentNode
  | VariantNode
  | InstanceNode
  | TextNode
  | ShapeNode
  | GroupNode
  | SliceNode;

export interface DocumentNode {
  type: 'document';
  id: string;
  name: string;
  children: DesignNode[];
}

export interface FrameNode {
  type: 'frame';
  id: string;
  name: string;
  typeName: string;
  x: number;
  y: number;
  width: number;
  height: number;
  paddingLeft: number;
  paddingRight: number;
  paddingTop: number;
  paddingBottom: number;
  itemCount: number;
  layoutMode: 'none' | 'horizontal' | 'vertical';
  primaryAxisAlignItems: 'min' | 'center' | 'max' | 'space-between';
  counterAxisAlignItems: 'min' | 'center' | 'max' | 'space-between';
  primaryAxisSpacing: number;
  counterAxisSpacing: number;
  constraints: Constraints;
  clipsContent: boolean;
  backgroundColor: ColorValue | null;
  borderRadius: BorderRadius;
  children: DesignNode[];
  layoutSettings?: LayoutSetting[];
  layoutProfiles?: string[];
  style: StyleReference;
  attributes?: Record<string, string>;
  codeExtensions?: CodeExtension[];
}

export interface ComponentNode {
  type: 'component';
  id: string;
  name: string;
  description: string;
  variants: VariantNode[];
  overrides?: ComponentOverride[];
  style: StyleReference;
  attributes?: Record<string, string>;
  codeExtensions?: CodeExtension[];
}

export interface VariantNode {
  type: 'variant';
  id: string;
  name: string;
  properties: VariantProperty[];
  children: DesignNode[];
  layoutSettings?: LayoutSetting[];
  style: StyleReference;
  constraints: Constraints;
  borderRadius: BorderRadius;
  backgroundColor: ColorValue | null;
}

export interface InstanceNode {
  type: 'instance';
  id: string;
  name: string;
  componentId: string;
  children: DesignNode[];
  overrides: Override[];
  style: StyleReference;
  constraints: Constraints;
  borderRadius: BorderRadius;
  backgroundColor: ColorValue | null;
}

export interface TextNode {
  type: 'text';
  id: string;
  name: string;
  characters: string;
  style: TextStyle;
  styleRef?: string;
  textStyleId?: string;
  variable?: string;
}

export interface TextStyle {
  fontFamily: string;
  fontPostScriptName?: string;
  fontWeight: number;
  fontSize: number;
  textAlignHorizontal: 'left' | 'center' | 'right' | 'justify';
  textAlignVertical: 'top' | 'center' | 'bottom';
  letterSpacing: number;
  lineHeightPx?: number;
  lineHeightPercent?: number;
  lineHeightUnit: 'PIXELS' | 'FONT_SIZE_%' | 'INTRINSIC_%';
  textDecoration?: 'none' | 'underline' | 'strikethrough';
  textAlignVerticalAlign?: 'cap' | 'alphabetic';
  listBulletIndent: number;
  paragraphSpacing?: number;
}

export interface ShapeNode {
  type: 'shape';
  id: string;
  name: string;
  geometry: PathGeometry;
  style: StyleReference;
  constraints: Constraints;
  borderRadius: BorderRadius;
  backgroundColor: ColorValue | null;
}

export interface GroupNode {
  type: 'group';
  id: string;
  name: string;
  children: DesignNode[];
  style: StyleReference;
  constraints: Constraints;
}

export interface SliceNode {
  type: 'slice';
  id: string;
  name: string;
  children: DesignNode[];
  exportSettings: ExportSetting[];
}

export interface StyleReference {
  fills?: Paint[];
  strokes?: Paint[];
  strokeWeight?: number;
  strokeAlign?: 'inside' | 'outside' | 'center';
  backgrounds?: Paint[];
  effectSchedules: EffectSchedule[];
  effects?: Effect[];
  gridStyles: GridStyle[];
}

export interface VariableRegistry {
  colors: Map<string, ColorVariable>;
  scalars: Map<string, NumberVariable>;
  strings: Map<string, StringVariable>;
  boolean: Map<string, BooleanVariable>;
  composite: Map<string, CompositeVariable>;
}

export interface ColorVariable {
  key: string;
  name: string;
  variableAlias?: string;
  resolvedValue: ColorValue;
  scopes: VariableScope[];
}

export interface NumberVariable {
  key: string;
  name: string;
  variableNumericAlignment?: 'integer' | 'any';
  resolvedValue: number;
  resolvedType: 'number' | 'string';
  scales: string[];
  defaultValue: number;
  scopes: VariableScope[];
}

export interface StringVariable {
  key: string;
  name: string;
  resolvedValue: string;
  defaultValue: string;
}

export interface BooleanVariable {
  key: string;
  name: string;
  resolvedValue: boolean;
  defaultValue: boolean;
}

export interface CompositeVariable {
  key: string;
  name: string;
  defaultValue: unknown;
}

export interface DesignTokenRegistry {
  colors: ColorToken[];
  spacing: SpacingToken[];
  typography: TypographyToken[];
  breakpoints: BreakpointToken[];
  shadows: ShadowToken[];
  borders: BorderToken[];
  opacity: OpacityToken[];
  radii: RadiusToken[];
  zIndices: zIndexToken[];
}

export interface ColorToken {
  name: string;
  value: ColorValue;
  type: 'color';
  description?: string;
}

export interface SpacingToken {
  name: string;
  value: number;
  type: 'spacing';
  description?: string;
}

export interface TypographyToken {
  name: string;
  fontFamily: string;
  fontWeight: number;
  fontSize: number;
  lineHeightPx?: number;
  lineHeightUnit: 'PIXELS' | 'FONT_SIZE_%' | 'INTRINSIC_%';
  letterSpacing?: number;
  textDecoration?: 'none' | 'underline' | 'strikethrough';
  textTransform?: 'none' | 'uppercase' | 'lowercase';
  type: 'typography';
  description?: string;
}

export interface BreakpointToken {
  name: string;
  minWidth: number;
  maxWidth?: number;
  type: 'breakpoint';
}

export interface ShadowToken {
  name: string;
  color: ColorValue;
  offsetX: number;
  offsetY: number;
  blur: number;
  spread: number;
  type: 'shadow';
  inner: boolean;
}

export interface BorderToken {
  name: string;
  width: number;
  color: ColorValue;
  style?: 'solid' | 'dash' | 'dot';
  type: 'border';
}

export interface OpacityToken {
  name: string;
  value: number;
  type: 'opacity';
}

export interface RadiusToken {
  name: string;
  value: number;
  type: 'radius';
}

export interface zIndexToken {
  name: string;
  value: number;
  type: 'zIndex';
}

export interface ColorValue {
  r: number;
  g: number;
  b: number;
  a: number;
}

export interface Constraints {
  vertical: 'top' | 'bottom' | 'center' | 'topBottom' | 'stretch' | 'minMax';
  horizontal: 'left' | 'right' | 'center' | 'leftRight' | 'stretch' | 'minMax';
}

export interface BorderRadius {
  topLeft: number;
  topRight: number;
  bottomLeft: number;
  bottomRight: number;
}

export interface Paint {
  type: 'SOLID' | 'GRADIENT_LINEAR' | 'GRADIENT_RADIAL' | 'IMAGE';
  color?: ColorValue;
  handleSize?: number;
  visible?: boolean;
  opacity?: number;
  gradientStops?: GradientStop[];
}

export interface GradientStop {
  position: number;
  color: ColorValue;
}

export type EffectType = 'DROP_SHADOW' | 'INNER_SHADOW' | 'LAYER_BLUR' | 'BACKGROUND_BLUR';

export interface Effect {
  type: EffectType;
  visible: boolean;
  radius: number;
  color: ColorValue;
  spread?: number;
  offset?: Vector2D;
  inner: boolean;
}

export interface EffectSchedule {
  [key: string]: boolean;
}

export interface GridStyle {
  pattern: 'columns' | 'rows' | 'grid';
  sectionSize: number;
  sectionColors?: ColorValue[];
  visible?: boolean;
  stiffness?: number;
}

export interface LayoutSetting {
  gridRow?: number;
  gridColumn?: number;
}

export interface VariantProperty {
  name: string;
  value: string;
}

export interface Override {
  id: string;
  name: string;
  value: string;
}

export interface PathGeometry {
  path: string;
  winding: 'evenOdd' | 'nonZero';
}

export interface ExportSetting {
  suffix: string;
  format: 'PNG' | 'SVG' | 'JPEG';
  scale: number;
}

export interface Vector2D {
  x: number;
  y: number;
}

export interface CodeExtension {
  platform: string;
  type: string;
  value: unknown;
}

export interface ComponentOverride {
  componentId: string;
  property: string;
  value: unknown;
}

export interface VariableScope {
  documentID?: string;
  localNodeIDs?: string[];
  cellID?: string;
}