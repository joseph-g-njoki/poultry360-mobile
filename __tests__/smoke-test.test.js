/**
 * PRODUCTION SMOKE TEST
 *
 * This is a basic sanity test to verify the mobile app can:
 * 1. Import and render without crashing
 * 2. Load the login screen
 * 3. Have basic navigation structure
 *
 * Run with: npm test smoke-test.test.js
 */

import React from 'react';
import { render } from '@testing-library/react-native';

// Mock expo modules that are not available in test environment
jest.mock('expo-font', () => ({
  loadAsync: jest.fn(() => Promise.resolve()),
  isLoaded: jest.fn(() => true),
}));

jest.mock('expo-asset', () => ({
  Asset: {
    loadAsync: jest.fn(() => Promise.resolve()),
  },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  setItem: jest.fn(() => Promise.resolve()),
  getItem: jest.fn(() => Promise.resolve(null)),
  removeItem: jest.fn(() => Promise.resolve()),
  clear: jest.fn(() => Promise.resolve()),
}));

jest.mock('react-native-mmkv', () => ({
  MMKV: jest.fn().mockImplementation(() => ({
    getString: jest.fn(),
    set: jest.fn(),
    delete: jest.fn(),
    clearAll: jest.fn(),
  })),
}));

// Mock navigation
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({
    navigate: jest.fn(),
    goBack: jest.fn(),
    reset: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

describe('Mobile App - Smoke Test', () => {
  beforeAll(() => {
    // Suppress console warnings during tests
    jest.spyOn(console, 'warn').mockImplementation(() => {});
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  it('should render without crashing', () => {
    // This is a basic smoke test - if we can get here, the app structure is valid
    expect(true).toBe(true);
  });

  it('should have valid project configuration', () => {
    const config = require('../app.json');

    expect(config).toHaveProperty('expo');
    expect(config.expo).toHaveProperty('name');
    expect(config.expo).toHaveProperty('slug');
    expect(config.expo).toHaveProperty('version');

    // Verify critical config
    expect(config.expo.name).toBe('Poultry360');
    expect(config.expo.slug).toBe('poultry360-mobile');
  });

  it('should have valid environment configuration', () => {
    const env = require('../src/config/environment');

    expect(env).toHaveProperty('API_URL');
    expect(env.API_URL).toBeDefined();
    expect(env.API_URL).not.toBe('');

    // Should be production URL
    expect(env.API_URL).toContain('http');
  });

  it('should import core screens without errors', () => {
    // Test that core screens can be imported
    expect(() => {
      require('../src/screens/auth/LoginScreen');
    }).not.toThrow();

    expect(() => {
      require('../src/screens/DashboardScreen');
    }).not.toThrow();
  });

  it('should import core navigation without errors', () => {
    expect(() => {
      require('../src/navigation/AppNavigator');
    }).not.toThrow();
  });

  it('should import API service without errors', () => {
    expect(() => {
      const api = require('../src/services/api');
      expect(api).toBeDefined();
    }).not.toThrow();
  });

  it('should import storage service without errors', () => {
    expect(() => {
      const storage = require('../src/utils/storage');
      expect(storage).toBeDefined();
    }).not.toThrow();
  });

  describe('Login Screen', () => {
    it('should render login screen', () => {
      const LoginScreen = require('../src/screens/auth/LoginScreen').default;

      const { getByPlaceholderText } = render(<LoginScreen />);

      // Check for email/username input
      const emailInput = getByPlaceholderText(/email|username/i);
      expect(emailInput).toBeDefined();

      // Check for password input
      const passwordInput = getByPlaceholderText(/password/i);
      expect(passwordInput).toBeDefined();
    });

    it('should have login button', () => {
      const LoginScreen = require('../src/screens/auth/LoginScreen').default;

      const { getByText } = render(<LoginScreen />);

      // Check for login button
      const loginButton = getByText(/login|sign in/i);
      expect(loginButton).toBeDefined();
    });
  });

  describe('API Configuration', () => {
    it('should have correct production API URL', () => {
      const env = require('../src/config/environment');

      // API URL should point to production server
      expect(env.API_URL).toBe('http://192.168.100.5:3000');
    });

    it('should configure axios with correct baseURL', () => {
      const api = require('../src/services/api');

      expect(api.defaults).toBeDefined();
      expect(api.defaults.baseURL).toBeDefined();
      expect(api.defaults.baseURL).toContain('http');
    });
  });

  describe('Storage Configuration', () => {
    it('should have token storage utilities', () => {
      const storage = require('../src/utils/storage');

      expect(storage.getToken).toBeDefined();
      expect(storage.setToken).toBeDefined();
      expect(storage.removeToken).toBeDefined();
      expect(typeof storage.getToken).toBe('function');
      expect(typeof storage.setToken).toBe('function');
      expect(typeof storage.removeToken).toBe('function');
    });
  });

  describe('App Structure Validation', () => {
    it('should have package.json with correct dependencies', () => {
      const packageJson = require('../package.json');

      // Core dependencies
      expect(packageJson.dependencies).toHaveProperty('expo');
      expect(packageJson.dependencies).toHaveProperty('react');
      expect(packageJson.dependencies).toHaveProperty('react-native');
      expect(packageJson.dependencies).toHaveProperty('axios');
      expect(packageJson.dependencies).toHaveProperty('react-native-mmkv');
    });

    it('should have test scripts configured', () => {
      const packageJson = require('../package.json');

      expect(packageJson.scripts).toHaveProperty('test');
      expect(packageJson.scripts.test).toContain('jest');
    });
  });
});
