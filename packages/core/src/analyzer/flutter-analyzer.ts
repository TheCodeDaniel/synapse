/**
 * Flutter Project Analyzer - Scans a Flutter project and generates a Project Graph.
 */

import * as fs from "fs";
import * as path from "path";
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
} from "../types";

export class FlutterAnalyzer {
  private rootPath: string;
  private logger?: any;

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
    const architecture = this.analyzeArchitecture(libDir, widgets);

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

    const content = fs.readFileSync(pubspecPath, "utf-8");
    // Simple YAML parsing for pubspec (avoids external dependency)
    const result: Record<string, unknown> = {};
    let currentKey: string | null = null;

    for (const line of content.split("\n")) {
      if (!line.trim() || line.startsWith("#")) continue;

      const match = line.match(/^(\w[\w_-]*)\s*:\s*(.*)$/);
      if (match) {
        const [, key, value] = match;
        result[currentKey ?? key] = value?.trim();
        currentKey = key;
      } else if (line.startsWith("  - ")) {
        // Array item under current key
      }
    }

    return result as Record<string, unknown>;
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
    if (!fs.existsSync(pubspecPath)) {
      return {
        pubspecPath: "",
        dependencies: {},
        devDependencies: {},
        flutterSdk: "",
        keyPackages: [],
      };
    }

    const content = fs.readFileSync(pubspecPath, "utf-8");
    const deps: Record<string, string> = {};
    const devDeps: Record<string, string> = {};
    let section: "dependencies" | "dev_dependencies" | null = null;

    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;

      if (trimmed === "dependencies:") {
        section = "dependencies";
        continue;
      }
      if (trimmed === "dev_dependencies:") {
        section = "dev_dependencies";
        continue;
      }

      const depMatch = line.match(/^\s+(\w[\w_-]*):\s*(.*)$/);
      if (depMatch) {
        const [_, name, version] = depMatch;
        if (section === "dependencies") deps[name] = version.trim();
        else if (section === "dev_dependencies") devDeps[name] = version.trim();
      }
    }

    return {
      pubspecPath,
      dependencies: deps,
      devDependencies: devDeps,
      flutterSdk: "",
      keyPackages: Object.keys(deps).filter((d) =>
        ["flutter_bloc", "bloc", "riverpod", "get_it", "dio", "go_router"].some(
          (k) => d.includes(k),
        ),
      ),
    };
  }

  private scanAssets(pubspecContent: Record<string, unknown>): AssetInfo {
    return { images: [], fonts: [], locales: [], others: [] };
  }

  private detectConventions(
    widgets: Map<string, WidgetDefinition>,
    libDir: string,
  ): ProjectConventions {
    const namingConvention: NamingRules = {
      files: "camelCase",
      classes: "PascalCase",
      variables: "camelCase",
      constants: "UPPER_SNAKE_CASE" as any,
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
  ): any {
    const hasCleanArch =
      fs.existsSync(path.join(libDir, "src")) ||
      (fs.existsSync(path.join(libDir, "features")) &&
        fs.existsSync(path.join(libDir, "shared")));

    return {
      pattern: hasCleanArch ? "clean_architecture" : "feature_folder",
      folders: this.detectFolderStructure(libDir),
      hasTestFolder: fs.existsSync(path.join(this.rootPath, "test")),
      hasIntegrationTest: fs.existsSync(
        path.join(this.rootPath, "integration_test"),
      ),
    };
  }

  private detectFolderStructure(libDir: string): any {
    const items = fs.readdirSync(libDir);
    return {
      lib: libDir,
      features: {},
      shared: {},
      assets: "",
      locales: "",
      config: "",
    };
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
