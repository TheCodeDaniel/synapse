/**
 * Flutter Project Analyzer - Scans a Flutter project and generates a Project Graph.
 */

import * as fs from "fs";
import * as path from "path";
import * as yaml from "js-yaml";
import {
  ProjectGraph,
  WidgetDefinition,
  ThemeRegistry,
  RoutingInfo,
  LocalizationInfo,
  ModelDefinition,
  ServiceDefinition,
  RepositoryDefinition,
  DependencyInfo,
  AssetInfo,
  ProjectConventions,
  NamingRules,
  CodeStyleRules,
  FileStructureRules,
  ImportOrdering,
  ArchitectureInfo,
  FolderStructure,
  FeatureModule,
  SharedResources,
} from "../types";

export class FlutterAnalyzer {
  private rootPath: string;

  constructor(rootPath: string) {
    this.rootPath = path.resolve(rootPath);
  }

  async analyze(): Promise<ProjectGraph> {
    const startTime = Date.now();

    if (!fs.existsSync(this.rootPath)) {
      throw new Error(`Flutter project not found at ${this.rootPath}`);
    }

    const pubspecContent = this.readPubspec();
    const libDir = path.join(this.rootPath, "lib");
    const hasLibDir = fs.existsSync(libDir);

    const widgets = await this.scanWidgets(libDir);
    const themes = this.analyzeThemes(libDir);
    const routing = this.analyzeRouting(libDir);
    const localization = this.analyzeLocalization(libDir);
    const models = await this.scanModels(libDir);
    const services = await this.scanServices(libDir);
    const repositories = await this.scanRepositories(libDir);
    const dependencies = this.readDependencies();
    const assets = this.scanAssets(pubspecContent);
    const conventions = this.detectConventions(widgets, libDir);
    const architecture = this.analyzeArchitecture(libDir, widgets, dependencies);

    return {
      id: `flutter_${Date.now()}`,
      version: "1.0.0",
      projectName:
        (pubspecContent.name as string) ?? path.basename(this.rootPath),
      flutterSdkVersion: await this.getFlutterVersion(),
      dartSdkVersion: await this.getDartVersion(),
      analyzedAt: new Date().toISOString(),
      rootPath: this.rootPath,
      architecture,
      widgets,
      themes,
      routing,
      localization,
      models,
      services,
      repositories,
      dependencies,
      assets,
      conventions,
    };
  }

  private readPubspec(): Record<string, unknown> {
    const pubspecPath = path.join(this.rootPath, "pubspec.yaml");
    if (!fs.existsSync(pubspecPath)) return {};

    try {
      const content = fs.readFileSync(pubspecPath, "utf-8");
      const parsed = yaml.load(content);
      return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {};
    } catch {
      return {};
    }
  }

  private async scanWidgets(
    libDir: string,
  ): Promise<Map<string, WidgetDefinition>> {
    const widgets = new Map<string, WidgetDefinition>();

    if (!fs.existsSync(libDir)) return widgets;

    const dartFiles = this.findDartFiles(libDir);

    for (const file of dartFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const widgetDefs = this.extractWidgets(content, file, libDir);
        for (const w of widgetDefs) {
          widgets.set(w.id, w);
        }
      } catch {
        // Skip files that can't be read
      }
    }

    return widgets;
  }

  private async scanModels(
    libDir: string,
  ): Promise<Map<string, ModelDefinition>> {
    const models = new Map<string, ModelDefinition>();
    if (!fs.existsSync(libDir)) return models;

    const dartFiles = this.findDartFiles(libDir);

    for (const file of dartFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const modelDefs = this.extractModels(content, file, libDir);
        for (const m of modelDefs) {
          models.set(m.id, m);
        }
      } catch {
        // Skip
      }
    }

    return models;
  }

  private async scanServices(
    libDir: string,
  ): Promise<Map<string, ServiceDefinition>> {
    const services = new Map<string, ServiceDefinition>();
    if (!fs.existsSync(libDir)) return services;

    const dartFiles = this.findDartFiles(libDir);

    for (const file of dartFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const serviceDefs = this.extractServices(content, file, libDir);
        for (const s of serviceDefs) {
          services.set(s.id, s);
        }
      } catch {
        // Skip
      }
    }

    return services;
  }

  private async scanRepositories(
    libDir: string,
  ): Promise<Map<string, RepositoryDefinition>> {
    const repos = new Map<string, RepositoryDefinition>();
    if (!fs.existsSync(libDir)) return repos;

    const dartFiles = this.findDartFiles(libDir);

    for (const file of dartFiles) {
      try {
        const content = fs.readFileSync(file, "utf-8");
        const repoDefs = this.extractRepositories(content, file, libDir);
        for (const r of repoDefs) {
          repos.set(r.id, r);
        }
      } catch {
        // Skip
      }
    }

    return repos;
  }

  private findDartFiles(dir: string): string[] {
    const files: string[] = [];
    const items = fs.readdirSync(dir, { withFileTypes: true });

    for (const item of items) {
      const fullPath = path.join(dir, item.name);
      if (item.isDirectory()) {
        files.push(...this.findDartFiles(fullPath));
      } else if (item.isFile() && item.name.endsWith(".dart")) {
        files.push(fullPath);
      }
    }

    return files;
  }

  private extractWidgets(
    content: string,
    filePath: string,
    libDir: string,
  ): WidgetDefinition[] {
    const widgets: WidgetDefinition[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const statelessMatch = line.match(
        /class\s+(\w+)\s+extends\s+StatelessWidget/,
      );
      if (statelessMatch) {
        widgets.push(
          this.createWidgetDef(
            statelessMatch[1],
            filePath,
            libDir,
            "stateless",
          ),
        );
        continue;
      }

      const statefulMatch = line.match(
        /class\s+(\w+)\s+extends\s+StatefulWidget/,
      );
      if (statefulMatch) {
        widgets.push(
          this.createWidgetDef(statefulMatch[1], filePath, libDir, "stateful"),
        );
      }
    }

    return widgets;
  }

  private createWidgetDef(
    name: string,
    filePath: string,
    libDir: string,
    type: "stateless" | "stateful",
  ): WidgetDefinition {
    const relativePath = path.relative(libDir, filePath);
    return {
      id: `widget_${name.toLowerCase()}`,
      name,
      filePath,
      relativePath,
      type,
      extends: type === "stateless" ? "StatelessWidget" : "StatefulWidget",
      parameters: [],
      hasChildren: false,
      childCount: 0,
      imports: [],
      isPublic: true,
    };
  }

  private extractModels(
    content: string,
    filePath: string,
    libDir: string,
  ): ModelDefinition[] {
    const models: ModelDefinition[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const match = line.match(/class\s+(\w+)\s*(extends|{)/);
      if (
        match &&
        !line.includes("Widget") &&
        !line.includes("Bloc") &&
        !line.includes("Provider")
      ) {
        const name = match[1];
        models.push({
          id: `model_${name.toLowerCase()}`,
          name,
          filePath,
          relativePath: path.relative(libDir, filePath),
          fields: [],
          toJsonMethod: content.includes("toJson"),
          fromJsonMethod:
            content.includes("fromJson") || content.includes(".from"),
          equalsAndHashCode:
            content.includes("operator ==") && content.includes("hashCode"),
          isSerializable: false,
          hasCopyWith: content.includes("copyWith"),
        });
      }
    }

    return models;
  }

  private extractServices(
    content: string,
    filePath: string,
    libDir: string,
  ): ServiceDefinition[] {
    const services: ServiceDefinition[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      const match = line.match(/class\s+(\w+)(\s+implements|\s*{)/);
      if (match && !line.includes("Widget") && !line.includes("Bloc")) {
        const name = match[1];
        if (!name.startsWith("_")) {
          services.push({
            id: `service_${name.toLowerCase()}`,
            name,
            filePath,
            relativePath: path.relative(libDir, filePath),
            isAbstract: line.includes("abstract"),
            methods: [],
            dependencies: [],
          });
        }
      }
    }

    return services;
  }

  private extractRepositories(
    content: string,
    filePath: string,
    libDir: string,
  ): RepositoryDefinition[] {
    const repos: RepositoryDefinition[] = [];
    const lines = content.split("\n");

    for (const line of lines) {
      if (line.includes("Repository") || line.includes("repository")) {
        const match = line.match(/class\s+(\w+)/);
        if (match && !line.includes("Widget")) {
          const name = match[1];
          repos.push({
            id: `repo_${name.toLowerCase()}`,
            name,
            filePath,
            relativePath: path.relative(libDir, filePath),
            abstractClass: line.includes("abstract"),
            implementsInterfaces: [],
            methods: [],
            dataSources: [],
          });
        }
      }
    }

    return repos;
  }

  private analyzeThemes(libDir: string): ThemeRegistry {
    const colors = new Map<string, any>();
    const textStyles = new Map<string, any>();
    const breakpoints: any[] = [];
    const spacing: any[] = [];
    const shadows: any[] = [];
    const borders: any[] = [];
    const radii: any[] = [];

    if (!fs.existsSync(libDir)) {
      return {
        colors,
        textStyles,
        breakpoints,
        spacing,
        shadows,
        borders,
        radii,
      };
    }

    // Look for theme files
    const themeFiles = [
      "theme.dart",
      "app_theme.dart",
      "colors.dart",
      "typography.dart",
    ];
    for (const themeFile of themeFiles) {
      let searchPath: string;

      if (fs.existsSync(path.join(libDir, themeFile))) {
        searchPath = path.join(libDir, themeFile);
      } else if (fs.existsSync(path.join(libDir, "theme", themeFile))) {
        searchPath = path.join(libDir, "theme", themeFile);
      } else if (
        fs.existsSync(path.join(libDir, "shared", "themes", themeFile))
      ) {
        searchPath = path.join(libDir, "shared", "themes", themeFile);
      } else {
        continue;
      }

      try {
        const content = fs.readFileSync(searchPath, "utf-8");
        this.extractThemeData(content, colors, textStyles);
      } catch {
        // Skip
      }
    }

    return {
      colors,
      textStyles,
      breakpoints,
      spacing,
      shadows,
      borders,
      radii,
    };
  }

  private extractThemeData(
    content: string,
    colors: Map<string, any>,
    textStyles: Map<string, any>,
  ): void {
    const colorMatches = content.match(/Color\((?:0x[a-fA-F0-9]+|\d+)\)/g);
    if (colorMatches) {
      for (const match of colorMatches) {
        colors.set(`theme_color_${colors.size}`, { hexValue: match });
      }
    }

    const textStyleMatches = content.match(/TextStyle\([^)]*\)/g);
    if (textStyleMatches) {
      for (const match of textStyleMatches) {
        textStyles.set(`text_style_${textStyles.size}`, {
          flutterName: match.substring(0, 50),
        });
      }
    }
  }

  private analyzeRouting(libDir: string): RoutingInfo {
    const routeFiles = [
      "routes.dart",
      "app_routes.dart",
      "navigation.dart",
      "go_router.dart",
    ];
    let routesFile: string | null = null;

    for (const rf of routeFiles) {
      if (fs.existsSync(path.join(libDir, rf))) {
        routesFile = path.join(libDir, rf);
        break;
      }
    }

    if (
      !routesFile &&
      fs.existsSync(path.join(libDir, "routes", "app_routes.dart"))
    ) {
      routesFile = path.join(libDir, "routes", "app_routes.dart");
    }

    const hasGoRouter = this.hasDependency("go_router");
    const routeDefinitions: any[] = [];

    if (routesFile) {
      try {
        const content = fs.readFileSync(routesFile, "utf-8");
        const pathMatches = content.match(/['"]\/[\w/-]*['"]/g);
        if (pathMatches) {
          for (const pm of pathMatches) {
            routeDefinitions.push({
              name: "",
              path: pm.replace(/'/g, ""),
              widgetType: "",
            });
          }
        }
      } catch {
        // Skip
      }
    }

    return {
      hasGoRouter,
      routesFilePath: routesFile ?? "",
      routeDefinitions,
      hasTransitionAnimation: false,
    };
  }

  private analyzeLocalization(libDir: string): LocalizationInfo {
    const hasIntl =
      this.hasDependency("intl") || this.hasDependency("flutter_localizations");
    let localeFile: string | null = null;

    for (const lf of [
      "l10n.dart",
      "app_localizations.dart",
      "app_en.arb",
      "app_ar.arb",
    ]) {
      if (fs.existsSync(path.join(libDir, lf))) {
        localeFile = path.join(libDir, lf);
        break;
      }
    }

    const supportedLocales: string[] = [];
    if (localeFile) {
      try {
        const content = fs.readFileSync(localeFile, "utf-8");
        const localeMatches = content.match(/Locale\(['"](\w+)['"]/g);
        if (localeMatches) {
          for (const m of localeMatches) {
            const lm = m.match(/Locale\(['"](\w+)/);
            if (lm?.[1]) supportedLocales.push(lm[1]);
          }
        }
      } catch {
        // Skip
      }
    }

    return {
      hasIntl,
      localeFilePath: localeFile ?? undefined,
      supportedLocales,
      arrowKeysHandling: false,
      pluralization: false,
      rtlSupport: false,
    };
  }

  private readDependencies(): DependencyInfo {
    const pubspecPath = path.join(this.rootPath, "pubspec.yaml");
    const pubspec = this.readPubspec();

    if (!fs.existsSync(pubspecPath) || Object.keys(pubspec).length === 0) {
      return {
        pubspecPath: "",
        dependencies: {},
        devDependencies: {},
        flutterSdk: "",
        keyPackages: [],
      };
    }

    // Real YAML parsing means `dependency_overrides:` (or any other
    // top-level key) is naturally its own separate object — the previous
    // line-based parser tracked "current section" with no reset on other
    // top-level keys, so a dependency_overrides section's content leaked
    // into whichever of dependencies/dev_dependencies was scanned last.
    const deps = this.normalizeDependencyMap(pubspec.dependencies);
    const devDeps = this.normalizeDependencyMap(pubspec.dev_dependencies);
    const environment = pubspec.environment as { sdk?: string } | undefined;

    return {
      pubspecPath,
      dependencies: deps,
      devDependencies: devDeps,
      flutterSdk: environment?.sdk ?? "",
      keyPackages: Object.keys(deps).filter((d) =>
        ["flutter_bloc", "bloc", "riverpod", "get_it", "dio", "go_router"].some(
          (k) => d.includes(k),
        ),
      ),
    };
  }

  /**
   * A pubspec dependency's value can be a plain version string (`^1.2.3`),
   * an SDK reference (`{ sdk: flutter }`), a git/path/hosted spec, or `null`
   * (any version) — normalized here to a single display string per package.
   */
  private normalizeDependencyMap(value: unknown): Record<string, string> {
    if (!value || typeof value !== "object") return {};

    const result: Record<string, string> = {};
    for (const [name, spec] of Object.entries(value as Record<string, unknown>)) {
      if (typeof spec === "string") {
        result[name] = spec;
      } else if (spec && typeof spec === "object" && "sdk" in spec) {
        result[name] = `sdk:${(spec as { sdk: string }).sdk}`;
      } else {
        result[name] = spec === null || spec === undefined ? "any" : JSON.stringify(spec);
      }
    }
    return result;
  }

  private scanAssets(pubspecContent: Record<string, unknown>): AssetInfo {
    const flutterSection = (pubspecContent.flutter ?? {}) as { assets?: unknown; fonts?: unknown };
    const images: string[] = [];
    const others: string[] = [];
    const fonts: string[] = [];

    const imageExtensions = new Set([".png", ".jpg", ".jpeg", ".gif", ".webp", ".svg", ".ico", ".bmp"]);

    if (Array.isArray(flutterSection.assets)) {
      for (const entry of flutterSection.assets) {
        if (typeof entry !== "string") continue;
        const ext = path.extname(entry).toLowerCase();
        (imageExtensions.has(ext) ? images : others).push(entry);
      }
    }

    if (Array.isArray(flutterSection.fonts)) {
      for (const fontFamily of flutterSection.fonts) {
        const family = fontFamily as { family?: unknown; fonts?: unknown };
        if (Array.isArray(family.fonts)) {
          for (const font of family.fonts) {
            const assetPath = (font as { asset?: unknown }).asset;
            if (typeof assetPath === "string") fonts.push(assetPath);
          }
        } else if (typeof family.family === "string") {
          fonts.push(family.family);
        }
      }
    }

    return { images, fonts, locales: [], others };
  }

  private detectConventions(
    widgets: Map<string, WidgetDefinition>,
    libDir: string,
  ): ProjectConventions {
    const namingConvention: NamingRules = {
      files: "camelCase",
      classes: "PascalCase",
      variables: "camelCase",
      constants: "UPPER_SNAKE_CASE",
      methods: "camelCase",
      folders: "camelCase",
    };

    const codeStyle: CodeStyleRules = {
      trailingCommas: true,
      nullSafety: true,
      explicitReturnTypes: false,
      constConstructors: true,
      preferConstConstructor: true,
    };

    const importOrdering: ImportOrdering = {
      dartCoreFirst: true,
      flutterFirst: true,
      thirdPartyAfterFlutter: true,
      localImportsLast: true,
      grouped: true,
    };

    const fileStructure: FileStructureRules = {
      singleWidgetPerFile: true,
      partFiles: false,
      barrelExports: fs.existsSync(path.join(libDir, "exports.dart")),
      indexFiles: false,
    };

    return { namingConvention, importOrdering, fileStructure, codeStyle };
  }

  private analyzeArchitecture(
    libDir: string,
    widgets: Map<string, WidgetDefinition>,
    dependencies: DependencyInfo,
  ): ArchitectureInfo {
    const stateManagementPattern = this.detectStateManagementPattern(libDir, dependencies);

    const hasCleanArch =
      fs.existsSync(path.join(libDir, "src")) ||
      (fs.existsSync(path.join(libDir, "features")) &&
        fs.existsSync(path.join(libDir, "shared")));
    const structuralPattern: ArchitectureInfo["pattern"] = hasCleanArch ? "clean_architecture" : "feature_folder";

    return {
      pattern: stateManagementPattern ?? structuralPattern,
      folders: this.detectFolderStructure(libDir),
      hasTestFolder: fs.existsSync(path.join(this.rootPath, "test")),
      hasIntegrationTest: fs.existsSync(
        path.join(this.rootPath, "integration_test"),
      ),
    };
  }

  /**
   * Classifies state-management architecture from real signals: package
   * dependencies (already collected by readDependencies().keyPackages, but
   * previously never used for anything) plus source-level base-class/API
   * usage. Takes priority over the folder-based structural heuristic, since
   * "which state management library" is a stronger architectural signal
   * than "which folders exist".
   */
  private detectStateManagementPattern(
    libDir: string,
    dependencies: DependencyInfo,
  ): ArchitectureInfo["pattern"] | null {
    if (!fs.existsSync(libDir)) return null;

    const content = this.findDartFiles(libDir)
      .map(file => {
        try {
          return fs.readFileSync(file, "utf-8");
        } catch {
          return "";
        }
      })
      .join("\n");

    const usesBloc =
      /\bextends\s+(Bloc|Cubit)</.test(content) ||
      dependencies.keyPackages.some(pkg => pkg.includes("bloc"));

    const usesRiverpod =
      /\bextends\s+(Consumer(Stateful)?Widget|\w*Notifier)\b/.test(content) ||
      /\bref\.(watch|read|listen)\(/.test(content) ||
      dependencies.keyPackages.some(pkg => pkg.includes("riverpod"));

    const usesChangeNotifier =
      /\bextends\s+ChangeNotifier\b/.test(content) || /\bChangeNotifierProvider\b/.test(content);

    if (usesBloc) return "blocs";
    if (usesRiverpod) return "riverpod";
    if (usesChangeNotifier) return "mvvm";
    return null;
  }

  private detectFolderStructure(libDir: string): FolderStructure {
    if (!fs.existsSync(libDir)) {
      return { lib: libDir, features: {}, shared: this.detectSharedResources(path.join(libDir, "shared")), assets: "", locales: "", config: "" };
    }

    const featuresDir = path.join(libDir, "features");
    const features: Record<string, FeatureModule> = {};
    if (fs.existsSync(featuresDir)) {
      for (const entry of fs.readdirSync(featuresDir, { withFileTypes: true })) {
        if (!entry.isDirectory()) continue;
        features[entry.name] = this.analyzeFeatureModule(entry.name, path.join(featuresDir, entry.name));
      }
    }

    return {
      lib: libDir,
      src: fs.existsSync(path.join(libDir, "src")) ? path.join(libDir, "src") : undefined,
      features,
      shared: this.detectSharedResources(path.join(libDir, "shared")),
      assets: this.findSubdir(libDir, ["assets"]) ?? "",
      locales: this.findSubdir(libDir, ["l10n", "locales", "localization"]) ?? "",
      config: this.findSubdir(libDir, ["config", "core/config"]) ?? "",
    };
  }

  private analyzeFeatureModule(name: string, featurePath: string): FeatureModule {
    const content = this.findDartFiles(featurePath)
      .map(file => {
        try {
          return fs.readFileSync(file, "utf-8");
        } catch {
          return "";
        }
      })
      .join("\n");

    return {
      name,
      path: featurePath,
      hasRoutes: /\b(GoRoute|MaterialPageRoute|onGenerateRoute)\b/.test(content),
      hasWidgets: /\bextends\s+(Stateless|Stateful)Widget\b/.test(content),
      hasPages: fs.existsSync(featurePath) && this.findDartFiles(featurePath).some(f => /page|screen/i.test(path.basename(f))),
      hasBLoC: /\bextends\s+(Bloc|Cubit)</.test(content),
      hasProvider: /\bextends\s+ChangeNotifier\b|\bChangeNotifierProvider\b/.test(content),
      hasViewModel: /\bViewModel\b/.test(content),
    };
  }

  private detectSharedResources(sharedDir: string): SharedResources {
    const sub = (name: string): string => (fs.existsSync(path.join(sharedDir, name)) ? path.join(sharedDir, name) : "");
    return {
      widgets: sub("widgets"),
      themes: sub("themes") || sub("theme"),
      utils: sub("utils"),
      constants: sub("constants"),
      services: sub("services"),
      models: sub("models"),
      routes: sub("routes"),
      localization: sub("localization") || sub("l10n"),
    };
  }

  private findSubdir(baseDir: string, candidateNames: string[]): string | undefined {
    for (const name of candidateNames) {
      const candidate = path.join(baseDir, name);
      if (fs.existsSync(candidate)) return candidate;
    }
    return undefined;
  }

  private hasDependency(name: string): boolean {
    try {
      const content = fs.readFileSync(
        path.join(this.rootPath, "pubspec.yaml"),
        "utf-8",
      );
      return content.includes(`${name}:`);
    } catch {
      return false;
    }
  }

  private async getFlutterVersion(): Promise<string> {
    try {
      const { execSync } = require("child_process");
      return (
        execSync("flutter --version", { encoding: "utf-8" }).match(
          /Flutter (\d+\.\d+\.\d+)/,
        )?.[1] ?? "unknown"
      );
    } catch {
      return "unknown";
    }
  }

  private async getDartVersion(): Promise<string> {
    try {
      const { execSync } = require("child_process");
      return (
        execSync("dart --version", { encoding: "utf-8" }).match(
          /Dart version (\d+\.\d+\.\d+)/,
        )?.[1] ?? "unknown"
      );
    } catch {
      return "unknown";
    }
  }
}
