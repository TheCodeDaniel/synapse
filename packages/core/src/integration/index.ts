/**
 * Integration module - Merges generated files into the Flutter project.
 */

import * as fs from 'fs';
import * as path from 'path';

export interface IntegrationResult {
  filesModified: number;
  filesCreated: number;
  routesUpdated: string[];
  errors: string[];
}

const ROUTE_FILE_NAMES = new Set(['routes.dart', 'app_routes.dart', 'navigation.dart', 'go_router.dart', 'app_router.dart', 'router.dart', 'app_pages.dart']);
const ROUTE_DIR_NAMES = new Set(['routes', 'navigation']);

export class ProjectIntegrator {
  private projectRoot: string;

  constructor(projectRoot: string) {
    this.projectRoot = path.resolve(projectRoot);
  }

  async integrateGeneratedFiles(
    files: Array<{ filePath: string; content: string }>
  ): Promise<IntegrationResult> {
    const result: IntegrationResult = {
      filesModified: 0,
      filesCreated: 0,
      routesUpdated: [],
      errors: [],
    };

    for (const file of files) {
      try {
        const resolvedPath = path.join(this.projectRoot, file.filePath);

        // Ensure directory exists
        const dir = path.dirname(resolvedPath);
        fs.mkdirSync(dir, { recursive: true });

        // Check if file already exists
        const exists = fs.existsSync(resolvedPath);

        // Write the file with backup of existing content
        if (exists) {
          const backupPath = `${resolvedPath}.bak`;
          fs.copyFileSync(resolvedPath, backupPath);
          fs.writeFileSync(resolvedPath, file.content, 'utf-8');
          result.filesModified++;
        } else {
          fs.writeFileSync(resolvedPath, file.content, 'utf-8');
          result.filesCreated++;
        }

        // Check if this is a route registration file
        if (this.isRouteFile(file.filePath)) {
          result.routesUpdated.push(file.filePath);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        result.errors.push(`Failed to write ${file.filePath}: ${message}`);
      }
    }

    return result;
  }

  async updateRouteRegistrations(
    routeFile: string,
    routesToRegister: Array<{ path: string; widgetName: string }>
  ): Promise<void> {
    const resolvedPath = path.join(this.projectRoot, routeFile);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Route file not found: ${routeFile}`);
    }

    let content = fs.readFileSync(resolvedPath, 'utf-8');

    // This method only knows how to string-splice a MaterialApp-style
    // `routes: { 'path': (_) => Widget() }` map. Doing that to a
    // GoRoute-based file would produce syntactically wrong Dart, so refuse
    // rather than silently corrupting it.
    if (/\bGoRoute\s*\(/.test(content) || content.includes('package:go_router/')) {
      throw new Error(
        `${routeFile} appears to use go_router (GoRoute-based routing), which this method doesn't support editing yet — ` +
          `it only knows how to insert into a MaterialApp-style \`routes: { ... }\` map. Register the new route(s) manually.`
      );
    }

    const importsToAdd: string[] = [];
    const routesToAdd: string[] = [];

    for (const route of routesToRegister) {
      // Extract import path from widget name and path
      const widgetBaseName = path.basename(route.widgetName).replace(/\.dart$/, '');
      const importPath = `import '../${path.dirname(route.path)}/${widgetBaseName}.dart';`;

      if (!content.includes(widgetBaseName)) {
        importsToAdd.push(importPath);
        routesToAdd.push(`    '${route.path}': (_) => ${this.toPascalCase(widgetBaseName)}(),`);
      }
    }

    // Add imports at top after existing imports section
    if (importsToAdd.length > 0) {
      const importBlock = '\n' + importsToAdd.join('\n') + '\n';
      const lastImportIndex = content.lastIndexOf('import ');
      if (lastImportIndex !== -1) {
        const nextNewline = content.indexOf('\n', lastImportIndex);
        content = content.slice(0, nextNewline + 1) + importBlock + content.slice(nextNewline + 1);
      } else {
        content = importBlock + content;
      }
    }

    // Add routes before closing brace
    if (routesToAdd.length > 0 && content.includes('return')) {
      const routeBlock = '\n' + routesToAdd.join('\n') + '\n';
      const insertIndex = content.lastIndexOf('}');
      if (insertIndex !== -1) {
        content = content.slice(0, insertIndex) + routeBlock + content.slice(insertIndex);
      }
    }

    fs.writeFileSync(resolvedPath, content, 'utf-8');
  }

  async updateLocalization(
    localeFile: string,
    keysToRegister: Array<{ key: string; value: Record<string, string> }>
  ): Promise<void> {
    const resolvedPath = path.join(this.projectRoot, localeFile);

    if (!fs.existsSync(resolvedPath)) {
      throw new Error(`Localization file not found: ${localeFile}`);
    }

    let content = fs.readFileSync(resolvedPath, 'utf-8');

    for (const key of keysToRegister) {
      const existingKey = `"${key.key}"`;
      if (!content.includes(existingKey)) {
        // Find the last closing brace before the final two braces
        const lines = content.split('\n');
        let insertLine = -1;

        for (let i = lines.length - 1; i >= 0; i--) {
          if (lines[i].includes('}')) {
            insertLine = i + 1;
            break;
          }
        }

        const entries = Object.entries(key.value)
          .map(([lang, value]) => `      "${lang}": "${value}"`)
          .join(',\n');

        if (insertLine > 0) {
          lines.splice(insertLine, 0, `    "${key.key}": {\n${entries}\n  },`);
          content = lines.join('\n');
        }
      }
    }

    fs.writeFileSync(resolvedPath, content, 'utf-8');
  }

  async updateAssets(assetsToRegister: Array<{ path: string; type: string }>): Promise<void> {
    const pubspecPath = path.join(this.projectRoot, 'pubspec.yaml');

    if (!fs.existsSync(pubspecPath)) return;

    let content = fs.readFileSync(pubspecPath, 'utf-8');

    for (const asset of assetsToRegister) {
      if (content.includes(asset.path)) continue;

      const sectionKey = asset.type === 'font' ? 'fonts:' : 'assets:';
      const insertPos = this.findSectionInsertPosition(content, sectionKey);
      if (insertPos === null) continue; // section doesn't exist — leave the file untouched rather than guess where to create it

      content = content.slice(0, insertPos) + `    - ${asset.path}\n` + content.slice(insertPos);
    }

    fs.writeFileSync(pubspecPath, content, 'utf-8');
  }

  /**
   * Finds the character offset at which a new list item should be inserted
   * so it lands at the END of a YAML section (e.g. `flutter: assets:`), not
   * the start. Walks line-by-line from the section header, skipping blank
   * lines and lines indented *more* than the header (its existing list
   * items), stopping at the first line indented the same or less (the next
   * sibling key, or end of file).
   *
   * This is a deliberately lightweight, indentation-aware alternative to a
   * full YAML parse-and-reserialize (js-yaml is available and used
   * elsewhere) — pubspec.yaml is a hand-maintained file that commonly has
   * explanatory comments, which a parse/dump round-trip would silently
   * drop. A surgical string edit preserves everything else in the file.
   */
  private findSectionInsertPosition(content: string, sectionKey: string): number | null {
    const lines = content.split('\n');
    const headerIndex = lines.findIndex(line => line.trim() === sectionKey);
    if (headerIndex === -1) return null;

    const headerIndent = lines[headerIndex].match(/^\s*/)?.[0].length ?? 0;
    let endLine = lines.length;

    for (let i = headerIndex + 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      const indent = lines[i].match(/^\s*/)?.[0].length ?? 0;
      if (indent <= headerIndent) {
        endLine = i;
        break;
      }
    }

    let insertLine = endLine;
    while (insertLine > headerIndex + 1 && lines[insertLine - 1].trim() === '') {
      insertLine--;
    }

    return lines.slice(0, insertLine).join('\n').length + (insertLine > 0 ? 1 : 0);
  }

  /**
   * Whether a generated file is a route-registration file, checked by exact
   * basename (matching the same well-known names FlutterAnalyzer looks for)
   * or by living directly under a `routes/`/`navigation/` directory — not
   * by raw substring containment, which previously misclassified any file
   * whose path merely contained "pages" or "route" as a substring (e.g.
   * `pages_selector_widget.dart`, `message_pages.dart`).
   */
  private isRouteFile(filePath: string): boolean {
    const segments = filePath.split(/[\\/]/).map(s => s.toLowerCase());
    const fileName = segments[segments.length - 1] ?? '';
    const dirSegments = segments.slice(0, -1);

    if (ROUTE_FILE_NAMES.has(fileName)) return true;
    return dirSegments.some(dir => ROUTE_DIR_NAMES.has(dir));
  }

  private toPascalCase(str: string): string {
    return str
      .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
      .replace(/^([a-z])/, s => s.toUpperCase());
  }
}
