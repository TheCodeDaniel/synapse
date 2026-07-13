/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  // Reset jest.fn() call history between tests automatically — without this,
  // an `expect(mock).not.toHaveBeenCalled()` in one test can fail because of
  // a call recorded by an earlier test in the same file.
  clearMocks: true,
  // `!src/**/index.ts` used to exclude every file *named* index.ts, but in
  // this codebase most modules put their real implementation directly in
  // index.ts (PlanningEngine, UIAgent, IncrementalSync, ConfigLoader,
  // CodeValidator, ProjectIntegrator, ComponentDiscoveryEngine, Pipeline) —
  // that pattern was silently hiding almost the entire codebase from
  // coverage. Only the files that are genuinely pure re-export barrels are
  // excluded now.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/index.ts',
    '!src/types/index.ts',
    '!src/compiler/index.ts',
    '!src/utils/index.ts',
    '!src/oauth/index.ts',
    '!src/analyzer/index.ts',
    '!src/agent/providers/index.ts',
  ],
  coverageDirectory: 'coverage',
  // A real, currently-passing floor (current actuals: ~82% stmts / ~63%
  // branches / ~86% funcs / ~84% lines) — set a few points below actual so
  // normal development has headroom, while still catching a real coverage
  // regression.
  coverageThreshold: {
    global: {
      branches: 55,
      functions: 75,
      lines: 75,
      statements: 75,
    },
  },
};