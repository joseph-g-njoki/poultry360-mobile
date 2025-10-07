module.exports = {
  preset: 'jest-expo',
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|react-native-mmkv|axios|uuid)',
  ],
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  collectCoverageFrom: [
    'src/**/*.{js,jsx}',
    '!src/**/*.test.{js,jsx}',
    '!src/**/__tests__/**',
    '!**/node_modules/**',
  ],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
  testPathIgnorePatterns: ['/node_modules/', '/android/', '/ios/'],
  moduleNameMapper: {
    '\\.(jpg|jpeg|png|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
  },
  // CRASH FIX: Memory leak prevention in tests
  maxWorkers: 1, // Use single worker to prevent worker process hangs
  workerIdleMemoryLimit: '512MB', // Restart workers when memory exceeds limit
  detectOpenHandles: false, // Don't detect open handles (can cause hangs)
  forceExit: true, // Force exit after tests complete
  clearMocks: true, // Clear mock calls and instances between tests
  resetMocks: true, // Reset mock state between tests
  restoreMocks: true, // Restore original implementations between tests
};