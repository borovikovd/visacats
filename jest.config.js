module.exports = {
  testEnvironment: 'jsdom',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: [
    'main.js',
    '!node_modules/**',
  ],
  coverageThreshold: {
    global: {
      branches: 71,
      functions: 78,
      lines: 83,
      statements: 82,
    },
  },
  coverageReporters: ['text', 'lcov', 'html'],
  moduleFileExtensions: ['js'],
  transform: {}
};