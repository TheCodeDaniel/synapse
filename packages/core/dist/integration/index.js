"use strict";
/**
 * Integration module - Merges generated files into the Flutter project.
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectIntegrator = void 0;
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
class ProjectIntegrator {
    projectRoot;
    constructor(projectRoot) {
        this.projectRoot = path.resolve(projectRoot);
    }
    async integrateGeneratedFiles(files) {
        const result = {
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
                }
                else {
                    fs.writeFileSync(resolvedPath, file.content, 'utf-8');
                    result.filesCreated++;
                }
                // Check if this is a route registration file
                if (this.isRouteFile(file.filePath)) {
                    result.routesUpdated.push(file.filePath);
                }
            }
            catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                result.errors.push(`Failed to write ${file.filePath}: ${message}`);
            }
        }
        return result;
    }
    async updateRouteRegistrations(routeFile, routesToRegister) {
        const resolvedPath = path.join(this.projectRoot, routeFile);
        if (!fs.existsSync(resolvedPath)) {
            throw new Error(`Route file not found: ${routeFile}`);
        }
        let content = fs.readFileSync(resolvedPath, 'utf-8');
        const importsToAdd = [];
        const routesToAdd = [];
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
            }
            else {
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
    async updateLocalization(localeFile, keysToRegister) {
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
    async updateAssets(assetsToRegister) {
        const pubspecPath = path.join(this.projectRoot, 'pubspec.yaml');
        if (!fs.existsSync(pubspecPath))
            return;
        let content = fs.readFileSync(pubspecPath, 'utf-8');
        for (const asset of assetsToRegister) {
            const assetLine = `    - ${asset.path}`;
            if (!content.includes(asset.path)) {
                const sectionMarker = asset.type === 'font' ? 'fonts:' : 'assets:';
                const sectionIndex = content.indexOf(`  ${sectionMarker}`);
                if (sectionIndex !== -1) {
                    const nextSectionIndex = content.indexOf('  ', sectionIndex + 2);
                    const insertPos = nextSectionIndex > sectionIndex ? nextSectionIndex : content.length;
                    content = content.slice(0, insertPos) + `\n${assetLine}` + content.slice(insertPos);
                }
            }
        }
        fs.writeFileSync(pubspecPath, content, 'utf-8');
    }
    isRouteFile(filePath) {
        const routePatterns = ['route', 'navigation', 'app_', 'pages'];
        return routePatterns.some(p => filePath.toLowerCase().includes(p));
    }
    toPascalCase(str) {
        return str
            .replace(/[-_\s]+(.)?/g, (_, c) => (c ? c.toUpperCase() : ''))
            .replace(/^([a-z])/, s => s.toUpperCase());
    }
}
exports.ProjectIntegrator = ProjectIntegrator;
//# sourceMappingURL=index.js.map