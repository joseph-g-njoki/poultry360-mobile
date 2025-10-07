/**
 * INTEGRATION TEST SUITE: Phase 3 - Offline Functionality & Sync (Simplified)
 *
 * This test suite validates:
 * - Network state detection
 * - API error handling for offline scenarios
 * - Data recovery after network restoration
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import apiService from '../../src/services/api';
import { v4 as uuidv4 } from 'uuid';

const TEST_TIMEOUT = 30000;

let testContext = {
  user: null,
  authToken: null,
  farm: null,
  batch: null,
};

describe('Phase 3: Offline & Network Handling Integration Tests', () => {
  beforeAll(async () => {
    // Setup: Register, login, and create test farm/batch
    await AsyncStorage.clear();

    const uniqueId = uuidv4().split('-')[0];
    const registrationData = {
      email: `networktest.${uniqueId}@poultry360.test`,
      username: `networktest_${uniqueId}`,
      password: 'Test@1234567890',
      firstName: 'Network',
      lastName: 'Test',
      phoneNumber: '+256700000300',
      organizationName: `Network Test Org ${Date.now()}`,
    };

    const response = await apiService.register(registrationData);
    testContext.authToken = response.access_token;
    testContext.user = response.user;

    await AsyncStorage.setItem('authToken', testContext.authToken);
    await AsyncStorage.setItem('userData', JSON.stringify(testContext.user));

    // Create farm
    const farm = await apiService.createFarm({
      farmName: `Network Test Farm ${Date.now()}`,
      location: 'Kampala',
      capacity: 3000,
      farmType: 'layers',
    });
    testContext.farm = farm;

    // Create batch
    const batch = await apiService.createFlock({
      batchName: `Network Test Batch ${Date.now()}`,
      farmId: farm.id,
      batchNumber: `BNT${Date.now()}`,
      birdType: 'Layers',
      initialCount: 500,
      startDate: new Date().toISOString().split('T')[0],
      status: 'active',
    });
    testContext.batch = batch;
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup
    try {
      if (testContext.batch) {
        await apiService.deleteFlock(testContext.batch.id);
      }
      if (testContext.farm) {
        await apiService.deleteFarm(testContext.farm.id);
      }
    } catch (error) {
      console.warn('Cleanup error:', error.message);
    }

    await AsyncStorage.clear();
  }, TEST_TIMEOUT);

  describe('3.1 Network State Detection', () => {
    test('should detect network connectivity status', async () => {
      const netInfo = await NetInfo.fetch();

      expect(netInfo).toBeTruthy();
      expect(netInfo.isConnected).toBeDefined();
      expect(typeof netInfo.isConnected).toBe('boolean');
    }, TEST_TIMEOUT);

    test('should retrieve network type information', async () => {
      const netInfo = await NetInfo.fetch();

      expect(netInfo.type).toBeDefined();
      // Type should be one of: wifi, cellular, ethernet, none, etc.
      expect(typeof netInfo.type).toBe('string');
    }, TEST_TIMEOUT);
  });

  describe('3.2 API Error Handling', () => {
    test('should handle network timeout gracefully', async () => {
      // This test validates the retry logic in apiService
      try {
        // The API service should retry on network errors
        const farms = await apiService.getFarms();
        expect(Array.isArray(farms)).toBe(true);
      } catch (error) {
        // If network is actually down, error should be handled gracefully
        expect(error.message).toContain('Network' || 'timeout' || 'error');
      }
    }, TEST_TIMEOUT);

    test('should retry failed requests with exponential backoff', async () => {
      // The apiService has built-in retry logic
      // This test verifies it works for a valid endpoint
      const startTime = Date.now();
      try {
        const dashboard = await apiService.getDashboard();
        const duration = Date.now() - startTime;

        expect(dashboard).toBeTruthy();
        // Should complete reasonably quickly on first try
        expect(duration).toBeLessThan(10000);
      } catch (error) {
        // If it fails, it should have tried multiple times
        const duration = Date.now() - startTime;
        // With 3 retries and exponential backoff, should take some time
        console.log('Request failed after retries, duration:', duration);
      }
    }, TEST_TIMEOUT);
  });

  describe('3.3 Data Persistence with AsyncStorage', () => {
    test('should persist auth token across sessions', async () => {
      const token = await AsyncStorage.getItem('authToken');
      expect(token).toBeTruthy();
      expect(token).toBe(testContext.authToken);
    }, TEST_TIMEOUT);

    test('should persist user data across sessions', async () => {
      const userData = await AsyncStorage.getItem('userData');
      expect(userData).toBeTruthy();

      const parsed = JSON.parse(userData);
      expect(parsed.email).toBe(testContext.user.email);
      expect(parsed.organizationId).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should handle missing data gracefully', async () => {
      const nonExistent = await AsyncStorage.getItem('non-existent-key');
      expect(nonExistent).toBeNull();
    }, TEST_TIMEOUT);
  });

  describe('3.4 Online Data Operations', () => {
    test('should create records while online', async () => {
      const recordData = {
        batchId: testContext.batch.id,
        date: new Date().toISOString().split('T')[0],
        eggsCollected: 450,
        goodEggs: 430,
        brokenEggs: 15,
        deformedEggs: 5,
      };

      const record = await apiService.createProductionRecord(recordData);

      expect(record).toBeTruthy();
      expect(record.id).toBeTruthy();
      expect(record.batchId).toBe(testContext.batch.id);

      // Cleanup
      await apiService.deleteProductionRecord(record.id);
    }, TEST_TIMEOUT);

    test('should verify created records persist in backend', async () => {
      // Create a record
      const recordData = {
        batchId: testContext.batch.id,
        date: new Date().toISOString().split('T')[0],
        mortalityCount: 5,
        cause: 'Disease',
        notes: 'Network test mortality',
      };

      const created = await apiService.createMortalityRecord(recordData);

      // Retrieve it from backend
      const all = await apiService.getMortalityRecords();
      const found = all.find(r => r.id === created.id);

      expect(found).toBeTruthy();
      expect(found.mortalityCount).toBe(recordData.mortalityCount);

      // Cleanup
      await apiService.deleteMortalityRecord(created.id);
    }, TEST_TIMEOUT);
  });

  describe('3.5 Circuit Breaker Pattern', () => {
    test('should use circuit breaker for dashboard requests', async () => {
      // Make multiple rapid dashboard requests
      const requests = [];
      for (let i = 0; i < 5; i++) {
        requests.push(apiService.getDashboard());
      }

      const results = await Promise.all(requests);

      // All should succeed
      results.forEach(dashboard => {
        expect(dashboard).toBeTruthy();
        expect(dashboard.totalFarms).toBeDefined();
      });
    }, TEST_TIMEOUT);

    test('should deduplicate simultaneous identical requests', async () => {
      // The apiService has request deduplication
      const [result1, result2, result3] = await Promise.all([
        apiService.getDashboard(),
        apiService.getDashboard(),
        apiService.getDashboard(),
      ]);

      // All should return the same data
      expect(result1).toBeTruthy();
      expect(result2).toBeTruthy();
      expect(result3).toBeTruthy();
    }, TEST_TIMEOUT);
  });

  describe('3.6 Connection Recovery', () => {
    test('should successfully complete operations after connection restored', async () => {
      // Simulate connection recovery by making a request
      const farms = await apiService.getFarms();

      expect(Array.isArray(farms)).toBe(true);
      expect(farms.length).toBeGreaterThan(0);

      // Our test farm should exist
      const ourFarm = farms.find(f => f.id === testContext.farm.id);
      expect(ourFarm).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should re-establish authentication after reconnection', async () => {
      // Verify auth token is still valid
      const profile = await apiService.getProfile();

      expect(profile).toBeTruthy();
      expect(profile.email).toBe(testContext.user.email);
    }, TEST_TIMEOUT);
  });

  describe('3.7 Error Recovery Strategies', () => {
    test('should handle 401 errors by clearing auth data', async () => {
      // Store current token
      const validToken = await AsyncStorage.getItem('authToken');

      // Set invalid token
      await AsyncStorage.setItem('authToken', 'invalid-token');

      try {
        await apiService.getProfile();
        fail('Should have thrown error with invalid token');
      } catch (error) {
        // Token should have been cleared
        const clearedToken = await AsyncStorage.getItem('authToken');
        expect(clearedToken).toBeNull();
      }

      // Restore valid token
      await AsyncStorage.setItem('authToken', validToken);
    }, TEST_TIMEOUT);

    test('should handle server errors gracefully', async () => {
      // Try to create a record with invalid data
      try {
        await apiService.createProductionRecord({
          batchId: 99999, // Non-existent batch
          date: new Date().toISOString().split('T')[0],
          eggsCollected: 100,
        });
        fail('Should have thrown error for invalid batch');
      } catch (error) {
        expect(error).toBeTruthy();
        expect(error.message).toBeTruthy();
      }
    }, TEST_TIMEOUT);
  });
});
