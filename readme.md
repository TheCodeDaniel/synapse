# Design Intelligence MCP

A local-first developer tool that understands both Figma designs and existing Flutter codebases. It builds structured knowledge to enable an LLM to generate production-quality UI code while reusing existing widgets and respecting project conventions.

## Architecture Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Figma File    │────▶│  Design Compiler │────▶│ Design Graph │
└─────────────────┘     └──────────────────┘     └──────────────┘
                                                         │
┌─────────────────┐     ┌──────────────────┐     ┌────▼──────┐
│ Flutter Project │────▶│  Project Analyzer│────▶│Project Gr.│
└─────────────────┘     └──────────────────┘     └───────────┘
                                                         │
                                              ┌────────▼────────┐
                                              │  Planning Engine│
                                              └─────────────────┘
                                                         │
                                              ┌────────▼────────┐
                                              │    UI Agent     │
                                              └─────────────────┘
                                                         │
                                              ┌────────▼────────┐
                                              │   Code Validator│
                                              └─────────────────┘
                                                         │
                                              ┌────────▼────────┐
                                              │ Project Integr. │
                                              └─────────────────┘
```

### Key Principles

1. **Two Intermediate Representations**: Design Graph (from Figma) and Project Graph (from Flutter codebase) are the single sources of truth
2. **Deterministic Processing**: AI is only used for semantic matching, implementation planning, and UI generation - everything else uses deterministic logic
3. **Modular Architecture**: Each component can be independently tested and swapped

## Project Structure

```
design-intelligence-mcp/
├── packages/
│   ├── core/                          # TypeScript core engine
│   │   ├── src/
│   │   │   ├── types/                 # Shared type definitions
│   │   │   │   ├── design.graph.ts    # Design Graph types
│   │   │   │   ├── project.graph.ts   # Project Graph types
│   │   │   │   ├── planning.engine.ts # Planning Engine types
│   │   │   │   ├── config.ts          # Configuration types
│   │   │   │   ├── events.ts          # Event system types
│   │   │   │   └── results.ts         # Result pattern types
│   │   │   ├── config/                # Configuration loader
│   │   │   ├── utils/                 # Utilities (logger, cache)
│   │   │   ├── oauth/                 # Figma OAuth management
│   │   │   ├── compiler/              # Figma API client & Design Compiler
│   │   │   ├── analyzer/              # Flutter project analyzer
│   │   │   ├── planning/              # Planning engine (graph comparison)
│   │   │   ├── agent/                 # UI code generation agent
│   │   │   ├── validation/            # Code validation with Flutter tooling
│   │   │   ├── integration/           # File merging & project updates
│   │   │   └── sync/                  # Incremental change detection
│   │   └── test/                      # Unit tests
│   │
│   └── vscode-extension/              # VS Code extension (thin UI layer)
│       ├── src/
│       │   └── extension.ts           # Main entry point
│       └── package.json               # Extension manifest
│
├── package.json                       # Root workspace config
└── tsconfig.json                      # Shared TypeScript configuration
```

## Installation & Setup

### Prerequisites

- Node.js 18+ 
- npm (or pnpm)
- Figma account with API access
- Flutter SDK (for project analysis and validation)

### Quick Start

```bash
# Clone the repository
git clone https://github.com/TheCodeDaniel/synapse.git
cd synapse

# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test
```

## Configuration

Create a configuration file (`di.config.json`) in your Flutter project root:

```json
{
  "projectName": "my-flutter-app",
  "figma": {
    "accessToken": "your-figma-token-here",
    "cacheEnabled": true,
    "cacheTTLMinutes": 60
  },
  "flutter": {
    "projectPath": "/path/to/flutter/project",
    "incrementalAnalysis": true
  },
  "ai": {
    "provider": "openai",
    "apiKey": "your-openai-key",
    "model": "gpt-4o",
    "temperature": 0.2,
    "maxTokens": 8192
  },
  "logging": {
    "level": "info",
    "toConsole": true
  }
}
```

## Usage

### VS Code Extension Commands

| Command | Description |
|---------|-------------|
| `Design Intelligence: Import Figma File` | Import a Figma design file via URL |
| `Design Intelligence: Analyze Flutter Project` | Scan and index the Flutter project |
| `Design Intelligence: Generate Implementation Plan` | Compare graphs and create implementation plan |
| `Design Intelligence: Generate UI Code` | Generate Flutter UI code from plan |
| `Design Intelligence: Validate Generated Code` | Run dart format, analyze, flutter analyze |
| `Design Intelligence: Sync Changes` | Incremental sync with change detection |

### Programmatic API

```typescript
import { 
  ConfigLoader, 
  FigmaClient, 
  DesignCompiler, 
  FlutterAnalyzer, 
  PlanningEngine, 
  UIAgent, 
  CodeValidator,
  ProjectIntegrator
} from '@design-intelligence/core';

// 1. Load configuration
const config = new ConfigLoader({ /* ... */ }).getConfig();

// 2. Compile Figma design
const figmaClient = new FigmaClient(config.figma.accessToken, cache, logger);
const compiler = new DesignCompiler(figmaClient);
const designGraph = await compiler.compile(fileKey);

// 3. Analyze Flutter project
const analyzer = new FlutterAnalyzer(projectPath);
const projectGraph = await analyzer.analyze();

// 4. Generate implementation plan
const planner = new PlanningEngine();
const plan = await planner.compare(designGraph, projectGraph);

// 5. Generate UI code
const agent = new UIAgent(config.ai);
const results = await agent.generateBatch(plan.tasks, designGraph, projectGraph, plan);

// 6. Validate generated code
const validator = new CodeValidator(projectPath);
const validation = validator.validate();

// 7. Integrate into project
const integrator = new ProjectIntegrator(projectPath);
await integrator.integrateGeneratedFiles(filesToWrite);
```

## Phases & Implementation Status

| Phase | Component | Description | Status |
|-------|-----------|-------------|--------|
| 1 | Core Foundation | TypeScript monorepo, types, config, logging, caching | ✅ Complete |
| 2 | OAuth Management | Figma authentication, token refresh, secure storage | ✅ Complete |
| 3 | Design Compiler | Figma API client & Design Graph compilation | ✅ Complete |
| 4 | Flutter Analyzer | Project scanning, widget/theme/routing detection | ✅ Complete |
| 5 | Planning Engine | Graph comparison, semantic matching, task generation | ✅ Complete |
| 6 | UI Agent | LLM-based Flutter UI code generation (stub) | ⚠️ Stub |
| 7 | Validation | dart format/analyze/flutter analyze integration | ✅ Complete |
| 8 | Integration | File merging, route registration, asset updates | ✅ Complete |
| 9 | VS Code Extension | Thin UI layer over core engine | ✅ Complete |
| 10 | Incremental Sync | Change detection, selective re-compilation | ✅ Complete |

## Design Graph Schema

The Design Graph is a framework-agnostic representation of Figma design files that captures:

- **Pages & Frames**: Hierarchical structure with layout properties
- **Components & Variants**: Component definitions with variant properties
- **Instances**: Component references with overrides
- **Text Nodes**: Typography information including font, size, weight, alignment
- **Shapes & Groups**: Geometric elements and grouping
- **Variables**: Design tokens for colors, spacing, typography
- **Assets**: Images, SVGs, and other exported resources

## Project Graph Schema

The Project Graph represents a Flutter codebase structure capturing:

- **Widgets**: All stateless and stateful widgets with parameters
- **Theme Registry**: Colors, text styles, breakpoints, spacing, shadows
- **Routing**: Route definitions, GoRouter configuration, navigation patterns
- **Localization**: Supported locales, translation files
- **Models/Services/Repositories**: Architecture components
- **Dependencies**: pubspec dependencies and dev dependencies
- **Conventions**: Naming rules, import ordering, code style preferences

## Planning Engine

The deterministic planning engine compares the Design Graph with the Project Graph to:

1. Find reusable widgets via semantic name similarity matching
2. Identify missing components that need creation
3. Determine files requiring updates
4. Produce an ordered implementation plan with dependencies

### Matching Algorithm

- Exact match (score 1.0) → Reuse without modification
- High similarity (>0.7) → Reuse with minor modifications  
- Medium similarity (≥0.4) → Structural adaptation needed
- Below threshold → New component creation required

## AI Agent Design Token Limits

The UI Agent generates only Flutter UI code and:

### ✅ Generates
- Widget tree construction
- Layout and styling
- Responsive design patterns
- Accessibility labels
- Integration with existing themes/tokens

### ❌ Does NOT Generate (v1)
- API calls or state management
- Repository/service implementations
- Business logic
- Test files

## License

MIT