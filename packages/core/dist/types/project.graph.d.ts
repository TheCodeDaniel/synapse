/**
 * Project Graph types - Representation of a Flutter codebase structure.
 * Captures widgets, themes, routing, localization, architecture patterns, and dependencies.
 */
export interface ProjectGraph {
    id: string;
    version: string;
    projectName: string;
    flutterSdkVersion: string;
    dartSdkVersion: string;
    analyzedAt: string;
    rootPath: string;
    architecture: ArchitectureInfo;
    widgets: Map<string, WidgetDefinition>;
    themes: ThemeRegistry;
    routing: RoutingInfo;
    localization: LocalizationInfo;
    models: Map<string, ModelDefinition>;
    services: Map<string, ServiceDefinition>;
    repositories: Map<string, RepositoryDefinition>;
    dependencies: DependencyInfo;
    assets: AssetInfo;
    conventions: ProjectConventions;
}
export interface ArchitectureInfo {
    pattern: 'clean_architecture' | 'feature_folder' | 'layered' | 'mvvm' | 'blocs' | 'riverpod' | 'other';
    folders: FolderStructure;
    hasTestFolder: boolean;
    hasIntegrationTest: boolean;
}
export interface FolderStructure {
    lib: string;
    src?: string;
    features: Record<string, FeatureModule>;
    shared: SharedResources;
    assets: string;
    locales: string;
    config: string;
}
export interface FeatureModule {
    name: string;
    path: string;
    hasRoutes: boolean;
    hasWidgets: boolean;
    hasPages: boolean;
    hasBLoC?: boolean;
    hasProvider?: boolean;
    hasViewModel?: boolean;
}
export interface SharedResources {
    widgets: string;
    themes: string;
    utils: string;
    constants: string;
    services: string;
    models: string;
    routes: string;
    localization: string;
}
export interface WidgetDefinition {
    id: string;
    name: string;
    filePath: string;
    relativePath: string;
    type: 'stateless' | 'stateful';
    extends: 'StatelessWidget' | 'StatefulWidget';
    parameters: WidgetParameter[];
    hasChildren: boolean;
    childCount: number;
    imports: string[];
    exports?: string[];
    isPublic: boolean;
    description?: string;
    tags?: string[];
}
export interface WidgetParameter {
    name: string;
    type: string;
    required: boolean;
    defaultValue?: string;
}
export interface ThemeRegistry {
    colors: Map<string, ColorDefinition>;
    textStyles: Map<string, TextStyleDefinition>;
    breakpoints: BreakpointDefinition[];
    spacing: SpacingDefinition[];
    shadows: ShadowDefinition[];
    borders: BorderDefinition[];
    radii: RadiusDefinition[];
    fontFamily?: string;
    fontFamilies?: Record<string, string>;
    lightTheme?: ThemeConfig;
    darkTheme?: ThemeConfig;
}
export interface ColorDefinition {
    name: string;
    hexValue: string;
    flutterName?: string;
    description?: string;
}
export interface TextStyleDefinition {
    name: string;
    fontFamily?: string;
    fontWeight: string;
    fontSize: number;
    height?: number;
    letterSpacing?: number;
    flutterName?: string;
    description?: string;
}
export interface BreakpointDefinition {
    name: string;
    minWidth: number;
    maxWidth?: number;
    flutterVariable?: string;
}
export interface SpacingDefinition {
    name: string;
    value: number;
    flutterConstant?: string;
}
export interface ShadowDefinition {
    name: string;
    color: string;
    offset: [number, number];
    blur: number;
    spread?: number;
    flutterName?: string;
}
export interface BorderDefinition {
    name: string;
    width: number;
    color?: string;
    radius?: number;
    flutterName?: string;
}
export interface RadiusDefinition {
    name: string;
    value: number;
    flutterConstant?: string;
}
export interface ThemeConfig {
    primaryColor?: string;
    scaffoldBackgroundColor?: string;
    fontFamily?: string;
    textTheme?: Record<string, TextStyleDef>;
    colorScheme?: ColorSchemeConfig;
    appBarTheme?: AppConfigTheme;
    buttonTheme?: AppConfigTheme;
}
export interface TextStyleDef {
    fontFamily?: string;
    fontSize?: number;
    fontWeight: string;
    color?: string;
    height?: number;
}
export interface ColorSchemeConfig {
    primary?: string;
    secondary?: string;
    surface?: string;
    background?: string;
    error?: string;
    onPrimary?: string;
    onSecondary?: string;
    onSurface?: string;
    onBackground?: string;
    onError?: string;
}
export interface AppConfigTheme {
    backgroundColor?: string;
    foregroundColor?: string;
    iconTheme?: IconThemeConfig;
    textTheme?: ButtonTextTheme;
}
export interface IconThemeConfig {
    color?: string;
    opacity?: number;
    size?: number;
}
export declare enum ButtonTextTheme {
    Primary = "primary",
    Secondary = "secondary",
    Accent = "accent"
}
export interface RoutingInfo {
    hasGoRouter: boolean;
    routesFilePath: string;
    routeDefinitions: RouteDefinition[];
    hasTransitionAnimation: boolean;
}
export interface RouteDefinition {
    name: string;
    path: string;
    widgetType: string;
    filePath: string;
    requiresAuth: boolean;
    requiresGuard: boolean;
    children?: RouteDefinition[];
    parameters?: Record<string, string>;
}
export interface LocalizationInfo {
    hasIntl: boolean;
    localeFilePath?: string;
    supportedLocales: string[];
    arrowKeysHandling: boolean;
    pluralization: boolean;
    rtlSupport: boolean;
    generatedFile?: string;
}
export interface ModelDefinition {
    id: string;
    name: string;
    filePath: string;
    relativePath: string;
    fields: ModelField[];
    toJsonMethod: boolean;
    fromJsonMethod: boolean;
    equalsAndHashCode: boolean;
    isSerializable: boolean;
    hasCopyWith: boolean;
}
export interface ModelField {
    name: string;
    type: string;
    required: boolean;
    defaultValue?: string;
}
export interface ServiceDefinition {
    id: string;
    name: string;
    filePath: string;
    relativePath: string;
    isAbstract: boolean;
    methods: ServiceMethod[];
    dependencies: string[];
}
export interface ServiceMethod {
    name: string;
    returnType: string;
    isAsync: boolean;
    parameters: MethodParameter[];
}
export interface RepositoryDefinition {
    id: string;
    name: string;
    filePath: string;
    relativePath: string;
    abstractClass: boolean;
    implementsInterfaces: string[];
    methods: ServiceMethod[];
    dataSources: string[];
}
export interface MethodParameter {
    name: string;
    type: string;
    required: boolean;
}
export interface DependencyInfo {
    pubspecPath: string;
    dependencies: Record<string, string>;
    devDependencies: Record<string, string>;
    flutterSdk: string;
    keyPackages: string[];
}
export interface AssetInfo {
    images: string[];
    fonts: string[];
    locales: string[];
    others: string[];
}
export interface ProjectConventions {
    namingConvention: NamingRules;
    importOrdering: ImportOrdering;
    fileStructure: FileStructureRules;
    codeStyle: CodeStyleRules;
}
export interface NamingRules {
    files: 'camelCase' | 'snake_case' | 'PascalCase';
    classes: 'PascalCase';
    variables: 'camelCase';
    constants: 'UPPER_SNAKE_CASE' | 'camelCase';
    methods: 'camelCase';
    folders: 'camelCase' | 'snake_case';
}
export interface ImportOrdering {
    dartCoreFirst: boolean;
    flutterFirst: boolean;
    thirdPartyAfterFlutter: boolean;
    localImportsLast: boolean;
    grouped: boolean;
}
export interface FileStructureRules {
    singleWidgetPerFile: boolean;
    partFiles: boolean;
    barrelExports: boolean;
    indexFiles: boolean;
}
export interface CodeStyleRules {
    trailingCommas: boolean;
    nullSafety: boolean;
    explicitReturnTypes: boolean;
    constConstructors: boolean;
    preferConstConstructor: boolean;
}
//# sourceMappingURL=project.graph.d.ts.map