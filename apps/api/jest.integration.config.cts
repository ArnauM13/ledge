// Integration tests: need PostgreSQL (and the env set up by
// scripts/test-integration.mjs). Run with `npx nx run api:test-integration`.
module.exports = {
  displayName: 'api-integration',
  preset: '../../jest.preset.js',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/*.int-spec.ts'],
  transform: {
    '^.+\\.[tj]s$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.spec.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'html'],
  // Suites share one database: run them one after the other.
  maxWorkers: 1,
  testTimeout: 30000,
};
