"use strict";
/**
 * Design Intelligence VS Code Extension
 *
 * Main entry point for the VS Code extension.
 * Provides a thin UI layer over the core engine.
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
exports.activate = activate;
exports.deactivate = deactivate;
const vscode = __importStar(require("vscode"));
const core_1 = require("@design-intelligence/core");
let logger;
function activate(context) {
    // Initialize logger
    const config = vscode.workspace.getConfiguration('designIntelligence');
    const loggingConfig = {
        level: config.get('logLevel') || 'info',
        toConsole: true,
        toFile: false,
        filePath: undefined,
    };
    logger = (0, core_1.createLogger)(loggingConfig, 'DI-Extension');
    logger.info('Design Intelligence extension activated');
    // Register commands
    registerCommands(context);
}
function registerCommands(context) {
    context.subscriptions.push(vscode.commands.registerCommand('di.reload', () => {
        logger.info('Extension reloaded');
        vscode.window.showInformationMessage('Design Intelligence extension reloaded');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('design-intelligence.importFigmaFile', async () => {
        const url = await vscode.window.showInputBox({
            prompt: 'Enter Figma file URL',
            placeHolder: 'https://www.figma.com/file/...',
            validateInput: (value) => (!value ? 'URL is required' : ''),
        });
        if (!url)
            return;
        logger.info(`Importing Figma file: ${url}`);
        vscode.window.showInformationMessage('Figma import initiated. This feature requires configuration.');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('design-intelligence.analyzeProject', async () => {
        const folder = vscode.workspace.workspaceFolders?.[0];
        if (!folder) {
            vscode.window.showErrorMessage('No workspace folder open');
            return;
        }
        logger.info(`Analyzing project: ${folder.uri.fsPath}`);
        vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: 'Analyzing Flutter project...',
            cancellable: false,
        }, async (progress) => {
            progress.report({ increment: 50 });
            await new Promise(resolve => setTimeout(resolve, 2000));
            progress.report({ increment: 50 });
        });
        vscode.window.showInformationMessage('Project analysis initiated. This feature requires configuration.');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('design-intelligence.generatePlan', async () => {
        logger.info('Generating implementation plan');
        vscode.window.showInformationMessage('Plan generation initiated. This feature requires configuration.');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('design-intelligence.generateUI', async () => {
        logger.info('Generating UI code');
        vscode.window.showInformationMessage('UI generation initiated. This feature requires configuration.');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('design-intelligence.validateCode', async () => {
        logger.info('Validating code');
        vscode.window.showInformationMessage('Validation initiated. This feature requires configuration.');
    }));
    context.subscriptions.push(vscode.commands.registerCommand('design-intelligence.syncChanges', async () => {
        logger.info('Syncing changes');
        vscode.window.showInformationMessage('Sync initiated. This feature requires configuration.');
    }));
}
function deactivate() {
    logger.info('Design Intelligence extension deactivated');
}
//# sourceMappingURL=extension.js.map