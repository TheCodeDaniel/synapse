/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json'],
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  // `vscode` isn't a real installed package — it's provided by the real
  // extension host at runtime — so tests resolve it to a manual mock.
  moduleNameMapper: {
    '^vscode$': '<rootDir>/src/__mocks__/vscode.ts',
  },
  clearMocks: true,
  collectCoverageFrom: ['src/**/*.ts', '!src/__mocks__/**'],
  coverageDirectory: 'coverage',
};
