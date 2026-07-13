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
│   │   │   ├── discovery/             # Component Discovery Engine (repeated-pattern detection)
│   │   │   ├── analyzer/              # Flutter project analyzer
│   │   │   ├── planning/              # Planning engine (graph comparison)
│   │   │   ├── agent/                 # UI code generation agent + LLM providers (agent/providers/)
│   │   │   ├── validation/            # Code validation with Flutter tooling
│   │   │   ├── integration/           # File merging & project updates
│   │   │   ├── sync/                  # Incremental change detection
│   │   │   └── pipeline/              # Orchestrates the full flow end-to-end
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

Copy `di.config.json.example` to `di.config.json` in your Flutter project root:

```json
{
  "projectName": "my-flutter-app",
  "figma": {
    "accessToken": "",
    "cacheEnabled": true,
    "cacheTTLMinutes": 60
  },
  "flutter": {
    "projectPath": "/path/to/flutter/project",
    "incrementalAnalysis": true
  },
  "ai": {
    "provider": "anthropic",
    "apiKey": "",
    "model": "claude-sonnet-4-5",
    "temperature": 0.2,
    "maxTokens": 8192
  },
  "logging": {
    "level": "info",
    "toConsole": true
  }
}
```

Leave `figma.accessToken` and `ai.apiKey` blank and set them via environment variables instead (see `.env.example`) — `ConfigLoader` resolves `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `DI_CUSTOM_API_KEY` automatically based on `ai.provider`, so a real key never has to sit in a file that could get committed. See `SECURITY.md` for the full key-handling model (this also covers how the VS Code extension stores secrets via `SecretStorage` instead of this file).

`ai.provider` accepts `"openai"`, `"anthropic"`, or `"custom"` (any OpenAI-compatible endpoint — e.g. a self-hosted Qwen deployment behind vLLM/Ollama — via `ai.baseUrl`).

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

The simplest way to drive the full flow is `Pipeline`, which orchestrates every step below and emits `CoreEvent`s (`progress`, `design.compiled`, `project.analyzed`, `plan.generated`, `widget.generated`, `validation.completed`, `integration.completed`) as it goes — this is what the VS Code extension itself uses:

```typescript
import { ConfigLoader, Pipeline } from '@design-intelligence/core';

const config = new ConfigLoader().loadFromFile('di.config.json');
const pipeline = new Pipeline(config);
pipeline.on(event => console.log(event.type, event));

const designGraph = await pipeline.importFigmaFile(figmaFileKey);
const projectGraph = await pipeline.analyzeProject();
const plan = await pipeline.generatePlan();
const results = await pipeline.generateUI();
await pipeline.integrateFiles(results.filter(r => r.success).map(r => ({ filePath: r.filePath, content: r.content! })));
```

For finer-grained control, each step is its own class:

```typescript
import { 
  ConfigLoader, 
  FigmaClient, 
  DesignCompiler, 
  ComponentDiscoveryEngine,
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

// 2b. Detect repeated UI patterns that aren't formal Figma components
designGraph.discoveredPatterns = new ComponentDiscoveryEngine().discover(designGraph);

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
| 2 | OAuth Management | Figma authentication, token refresh, AES-256-GCM secret storage | ✅ Complete |
| 3 | Design Compiler | Figma API client & Design Graph compilation | ✅ Complete |
| 4 | Component Discovery Engine | Deterministic detection of repeated UI patterns not formalized as Figma components | ✅ Complete |
| 5 | Flutter Analyzer | Project scanning, widget/theme/routing detection, real Bloc/Riverpod/MVVM architecture reasoning | ✅ Complete |
| 6 | Planning Engine | Graph comparison, semantic matching, task generation (including discovered patterns) | ✅ Complete |
| 7 | UI Agent | LLM-based Flutter UI code generation — pluggable Anthropic/OpenAI/custom providers | ✅ Complete |
| 8 | Validation | dart format/analyze/flutter analyze integration, with real per-file line/column reporting | ✅ Complete |
| 9 | Integration | File merging, route registration, asset updates | ✅ Complete |
| 10 | Pipeline | Orchestrates the full flow end-to-end and emits progress/completion events | ✅ Complete |
| 11 | VS Code Extension | Thin UI layer over the Pipeline, with VS Code `SecretStorage`-backed credentials | ✅ Complete |
| 12 | Incremental Sync | Change detection, selective re-compilation | ✅ Complete |

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

## Contributing

See [CONTRIBUTING.md](./CONTRIBUTING.md) for local setup, project conventions, and what to check before opening a PR.

## Security

See [SECURITY.md](./SECURITY.md) for how API keys and tokens are handled, and how to report a vulnerability.

## License

[MIT](./LICENSE)