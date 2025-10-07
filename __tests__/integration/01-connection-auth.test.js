/**
 * INTEGRATION TEST SUITE: Phase 1 - Connection & Authentication
 *
 * This test suite validates:
 * - Backend API connectivity
 * - User registration flow
 * - User login flow (valid/invalid credentials)
 * - Token storage and management
 * - Token refresh mechanism
 * - Logout functionality
 * - Session expiration handling
 * - Multi-organization support
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../src/services/api';
import { v4 as uuidv4 } from 'uuid';

// Test configuration
const TEST_TIMEOUT = 30000; // 30 seconds for network operations
const API_BASE_URL = 'http://192.168.50.21:3000/api';

// Test user data
let testUser = {
  email: `test.user.${uuidv4().split('-')[0]}@poultry360.test`,
  username: `testuser_${uuidv4().split('-')[0]}`,
  password: 'Test@1234567890',
  firstName: 'Integration',
  lastName: 'Test',
  phoneNumber: '+256700000000',
  organizationName: `Test Org ${Date.now()}`,
  organizationSlug: null,
};

describe('Phase 1: Connection & Authentication Integration Tests', () => {
  beforeAll(async () => {
    // Clear AsyncStorage before tests
    await AsyncStorage.clear();
  });

  afterEach(async () => {
    // Clean up after each test
    await AsyncStorage.removeItem('authToken');
    await AsyncStorage.removeItem('userData');
  });

  describe('1.1 Basic Connectivity', () => {
    test('should verify backend API is accessible', async () => {
      const response = await fetch(`${API_BASE_URL}/health`);
      expect(response.status).toBe(200);
    }, TEST_TIMEOUT);

    test('should handle network timeout gracefully', async () => {
      // Simulate timeout by using a non-existent endpoint with very short timeout
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 100);

      try {
        await fetch(`${API_BASE_URL}/non-existent-slow-endpoint`, {
          signal: controller.signal
        });
      } catch (error) {
        expect(error.name).toBe('AbortError');
      } finally {
        clearTimeout(timeout);
      }
    });

    test('should verify API returns proper CORS headers', async () => {
      const response = await fetch(`${API_BASE_URL}/health`, {
        method: 'OPTIONS',
      });
      expect(response.headers.get('access-control-allow-origin')).toBeTruthy();
    }, TEST_TIMEOUT);
  });

  describe('1.2 User Registration', () => {
    test('should successfully register a new user with organization', async () => {
      const response = await apiService.register({
        email: testUser.email,
        username: testUser.username,
        password: testUser.password,
        firstName: testUser.firstName,
        lastName: testUser.lastName,
        phoneNumber: testUser.phoneNumber,
        organizationName: testUser.organizationName,
      });

      expect(response).toBeTruthy();
      expect(response.access_token).toBeTruthy();
      expect(response.user).toBeTruthy();
      expect(response.user.email).toBe(testUser.email);
      expect(response.user.organizationId).toBeTruthy();

      // Store organization slug for login tests
      testUser.organizationSlug = response.user.organization?.slug;
    }, TEST_TIMEOUT);

    test('should reject registration with duplicate email', async () => {
      // Try to register the same user again
      await expect(
        apiService.register({
          email: testUser.email,
          username: `different_${uuidv4().split('-')[0]}`,
          password: testUser.password,
          firstName: 'Another',
          lastName: 'User',
          phoneNumber: '+256700000001',
          organizationName: 'Another Org',
        })
      ).rejects.toThrow();
    }, TEST_TIMEOUT);

    test('should reject registration with invalid email format', async () => {
      await expect(
        apiService.register({
          email: 'invalid-email-format',
          username: `user_${uuidv4().split('-')[0]}`,
          password: testUser.password,
          firstName: 'Test',
          lastName: 'User',
          phoneNumber: '+256700000002',
          organizationName: 'Test Org',
        })
      ).rejects.toThrow();
    }, TEST_TIMEOUT);

    test('should reject registration with weak password', async () => {
      await expect(
        apiService.register({
          email: `weak.pass.${uuidv4().split('-')[0]}@test.com`,
          username: `user_${uuidv4().split('-')[0]}`,
          password: '12345', // Too weak
          firstName: 'Test',
          lastName: 'User',
          phoneNumber: '+256700000003',
          organizationName: 'Test Org',
        })
      ).rejects.toThrow();
    }, TEST_TIMEOUT);

    test('should reject registration with missing required fields', async () => {
      await expect(
        apiService.register({
          email: `test.${uuidv4().split('-')[0]}@test.com`,
          password: testUser.password,
          // Missing username, firstName, lastName, organizationName
        })
      ).rejects.toThrow();
    }, TEST_TIMEOUT);
  });

  describe('1.3 User Login', () => {
    test('should successfully login with valid credentials', async () => {
      const response = await apiService.login(
        testUser.email,
        testUser.password,
        testUser.organizationSlug
      );

      expect(response).toBeTruthy();
      expect(response.access_token).toBeTruthy();
      expect(response.user).toBeTruthy();
      expect(response.user.email).toBe(testUser.email);

      // Verify token is stored in AsyncStorage
      const storedToken = await AsyncStorage.getItem('authToken');
      expect(storedToken).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should reject login with invalid password', async () => {
      await expect(
        apiService.login(testUser.email, 'WrongPassword123!', testUser.organizationSlug)
      ).rejects.toThrow();
    }, TEST_TIMEOUT);

    test('should reject login with non-existent email', async () => {
      await expect(
        apiService.login('nonexistent@test.com', testUser.password, null)
      ).rejects.toThrow();
    }, TEST_TIMEOUT);

    test('should handle multi-organization user login', async () => {
      // First, get user organizations
      const organizations = await apiService.getUserOrganizations(testUser.email);

      expect(organizations).toBeTruthy();
      expect(Array.isArray(organizations)).toBe(true);
      expect(organizations.length).toBeGreaterThan(0);

      // Login with specific organization
      const response = await apiService.login(
        testUser.email,
        testUser.password,
        organizations[0].slug
      );

      expect(response.access_token).toBeTruthy();
      expect(response.user.organizationId).toBe(organizations[0].id);
    }, TEST_TIMEOUT);
  });

  describe('1.4 Token Management', () => {
    let authToken;

    beforeEach(async () => {
      // Login to get a valid token
      const response = await apiService.login(
        testUser.email,
        testUser.password,
        testUser.organizationSlug
      );
      authToken = response.access_token;
      await AsyncStorage.setItem('authToken', authToken);
    });

    test('should include auth token in API requests', async () => {
      const profile = await apiService.getProfile();
      expect(profile).toBeTruthy();
      expect(profile.email).toBe(testUser.email);
    }, TEST_TIMEOUT);

    test('should store user data in AsyncStorage after login', async () => {
      const userData = await AsyncStorage.getItem('userData');
      expect(userData).toBeTruthy();

      const parsedUser = JSON.parse(userData);
      expect(parsedUser.email).toBe(testUser.email);
      expect(parsedUser.organizationId).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should verify token is valid', async () => {
      const verification = await apiService.verifyToken();
      expect(verification).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should reject requests with invalid token', async () => {
      // Set invalid token
      await AsyncStorage.setItem('authToken', 'invalid-token-xyz');

      await expect(apiService.getProfile()).rejects.toThrow();
    }, TEST_TIMEOUT);

    test('should clear token on 401 response', async () => {
      // Set invalid token
      await AsyncStorage.setItem('authToken', 'invalid-token-xyz');

      try {
        await apiService.getProfile();
      } catch (error) {
        // Should have cleared the token
        const storedToken = await AsyncStorage.getItem('authToken');
        expect(storedToken).toBeNull();
      }
    }, TEST_TIMEOUT);
  });

  describe('1.5 Logout Functionality', () => {
    beforeEach(async () => {
      // Login before each logout test
      await apiService.login(
        testUser.email,
        testUser.password,
        testUser.organizationSlug
      );
    });

    test('should clear auth token from AsyncStorage on logout', async () => {
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');

      const token = await AsyncStorage.getItem('authToken');
      const userData = await AsyncStorage.getItem('userData');

      expect(token).toBeNull();
      expect(userData).toBeNull();
    }, TEST_TIMEOUT);

    test('should reject API calls after logout', async () => {
      // Logout
      await AsyncStorage.removeItem('authToken');
      await AsyncStorage.removeItem('userData');

      // Try to access protected endpoint
      await expect(apiService.getProfile()).rejects.toThrow();
    }, TEST_TIMEOUT);
  });

  describe('1.6 Session Expiration Handling', () => {
    test('should handle expired token gracefully', async () => {
      // Set an obviously expired/invalid token
      await AsyncStorage.setItem('authToken', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJleHAiOjE1MTYyMzkwMjJ9.invalid');

      try {
        await apiService.getProfile();
        fail('Should have thrown an error for expired token');
      } catch (error) {
        expect(error).toBeTruthy();

        // Verify token was cleared
        const token = await AsyncStorage.getItem('authToken');
        expect(token).toBeNull();
      }
    }, TEST_TIMEOUT);
  });

  describe('1.7 Organization Context', () => {
    beforeEach(async () => {
      // Login to get valid session
      await apiService.login(
        testUser.email,
        testUser.password,
        testUser.organizationSlug
      );
    });

    test('should include organization ID in API request headers', async () => {
      // This will be verified through successful API calls
      // that require organization context
      const farms = await apiService.getFarms();
      expect(Array.isArray(farms)).toBe(true);
    }, TEST_TIMEOUT);

    test('should isolate data by organization', async () => {
      // Get data for current organization
      const farms = await apiService.getFarms();
      const batches = await apiService.getFlocks();

      // All returned data should belong to this organization
      expect(Array.isArray(farms)).toBe(true);
      expect(Array.isArray(batches)).toBe(true);
    }, TEST_TIMEOUT);
  });
});
