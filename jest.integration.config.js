/**
 * Jest Configuration for Integration Tests
 *
 * This configuration is specifically for running comprehensive
 * integration tests that validate mobile app and backend connectivity.
 */

module.exports = {
  preset: 'jest-expo',
  testEnvironment: 'node',
  setupFilesAfterEnv: [
    '@testing-library/jest-native/extend-expect',
    '<rootDir>/__tests__/setup.js'
  ],
  transformIgnorePatterns: [
    'node_modules/(?!(jest-)?react-native|@react-native|@react-native-community|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|uuid)',
  ],
  testMatch: [
    '**/__tests__/integration/**/*.test.js',
    '**/__tests__/integration/**/*.test.ts',
  ],
  testTimeout: 40000, // 40 seconds for integration tests
  verbose: true,
  collectCoverage: false, // Disable coverage for integration tests
  maxWorkers: 1, // Run integration tests serially to avoid conflicts
  bail: false, // Continue running all tests even if some fail
};
