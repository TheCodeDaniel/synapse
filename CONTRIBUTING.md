# Contributing

Thanks for considering a contribution! This is an npm workspaces monorepo with two packages:

- `packages/core` — the TypeScript engine (Figma import, Flutter analysis, planning, LLM-based code generation, validation, integration, sync). This is where almost all of the logic lives.
- `packages/vscode-extension` — a thin UI layer over `packages/core`'s `Pipeline` class.

## Getting set up

```bash
git clone https://github.com/TheCodeDaniel/synapse.git
cd synapse
npm install
npm run build
npm test
npm run lint
```

`packages/core`'s test suite spawns real `dart format` / `dart analyze` / `flutter analyze` processes against fixture projects (see `packages/core/src/validation/__tests__/`) — a Dart/Flutter SDK on your `PATH` makes those assertions meaningful; without one, those specific checks fall back to a non-fatal warning path rather than failing.

## Project conventions

- **Deterministic vs. AI-assisted**: only `UIAgent` (and the `agent/providers/` LLM clients it wraps) should ever call out to a language model. Every other module — the Figma/Design Graph compiler, the Flutter/Project Graph analyzer, the Component Discovery Engine, the Planning Engine — is deterministic on purpose. If you're adding logic that needs "judgment," it almost certainly belongs behind `UIAgent`, not sprinkled into the deterministic pipeline.
- **Tests live next to the code** they cover, under `src/**/__tests__/*.test.ts` (not a top-level `test/` directory — that pattern isn't picked up by either package's `jest.config.js`).
- **Secrets never go in test fixtures or committed config.** See `SECURITY.md` for the key-handling model; tests that need an API key use a fake `LLMProvider`/mocked HTTP layer instead.
- **New modules should return `Result<T, AppError>`** (see `types/results.ts` — `ok()`, `err()`, `createError()`, `ErrorCode`) rather than throwing or inventing another ad-hoc `{success, error}` shape. Existing modules predate this convention and haven't all been migrated; match the convention of the function you're editing rather than mixing styles within one file.
- **`tsc --build` uses incremental caching** (`tsconfig.tsbuildinfo`). If you delete `dist/` to force a clean rebuild, also delete the matching `tsconfig.tsbuildinfo`, or `tsc --build` will assume nothing changed and silently produce no output.

## Before opening a PR

- `npm run build && npm test && npm run lint` should all pass from the repo root.
- If you fix a bug, add a regression test that would have caught it — that's the standard this codebase has been held to throughout its history so far.
- Keep changes scoped; this is a monorepo with fast-moving parts, and a focused diff is much easier to review than a sweeping one.
