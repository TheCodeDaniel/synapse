/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/index.ts',
  ],
  coverageDirectory: 'coverage',
  // NOTE: re-enabled with a real bar once coverage exists across the whole
  // codebase (tracked as Phase 8 of the implementation plan) — until then,
  // an 80% global gate would fail the build on every not-yet-tested module.
  // coverageThreshold: {
  //   global: {
  //     branches: 80,
  //     functions: 80,
  //     lines: 80,
  //     statements: 80,
  //   },
  // },
};