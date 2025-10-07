/**
 * INTEGRATION TEST SUITE: Phase 2 - Core Features
 *
 * This test suite validates:
 * - Dashboard data loading and accuracy
 * - Farm management (CRUD operations)
 * - Batch/Flock management (CRUD operations)
 * - Daily records (production, mortality, feed, water, weight)
 * - Data persistence and retrieval
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../src/services/api';
import { v4 as uuidv4 } from 'uuid';

const TEST_TIMEOUT = 30000;

// Test data will be populated during tests
let testContext = {
  user: null,
  authToken: null,
  farm: null,
  batch: null,
  productionRecord: null,
  mortalityRecord: null,
  feedRecord: null,
  waterRecord: null,
  weightRecord: null,
};

describe('Phase 2: Core Features Integration Tests', () => {
  beforeAll(async () => {
    // Setup: Register and login a test user
    await AsyncStorage.clear();

    const uniqueId = uuidv4().split('-')[0];
    const registrationData = {
      email: `coretest.${uniqueId}@poultry360.test`,
      username: `coretest_${uniqueId}`,
      password: 'Test@1234567890',
      firstName: 'Core',
      lastName: 'Test',
      phoneNumber: '+256700000100',
      organizationName: `Core Test Org ${Date.now()}`,
    };

    const response = await apiService.register(registrationData);
    testContext.authToken = response.access_token;
    testContext.user = response.user;

    await AsyncStorage.setItem('authToken', testContext.authToken);
    await AsyncStorage.setItem('userData', JSON.stringify(testContext.user));
  }, TEST_TIMEOUT);

  afterAll(async () => {
    // Cleanup: Delete test data
    try {
      if (testContext.productionRecord) {
        await apiService.deleteProductionRecord(testContext.productionRecord.id);
      }
      if (testContext.mortalityRecord) {
        await apiService.deleteMortalityRecord(testContext.mortalityRecord.id);
      }
      if (testContext.feedRecord) {
        await apiService.deleteFeedRecord(testContext.feedRecord.id);
      }
      if (testContext.waterRecord) {
        await apiService.deleteWaterRecord(testContext.waterRecord.id);
      }
      if (testContext.weightRecord) {
        await apiService.deleteWeightRecord(testContext.weightRecord.id);
      }
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

  describe('2.1 Dashboard Loading', () => {
    test('should successfully load dashboard data', async () => {
      const dashboard = await apiService.getDashboard();

      expect(dashboard).toBeTruthy();
      expect(typeof dashboard).toBe('object');

      // Dashboard should have key metrics
      expect(dashboard).toHaveProperty('totalFarms');
      expect(dashboard).toHaveProperty('totalBatches');
      expect(dashboard).toHaveProperty('activeBatches');
      expect(dashboard).toHaveProperty('totalBirds');
    }, TEST_TIMEOUT);

    test('should return valid data types for dashboard metrics', async () => {
      const dashboard = await apiService.getDashboard();

      expect(typeof dashboard.totalFarms).toBe('number');
      expect(typeof dashboard.totalBatches).toBe('number');
      expect(typeof dashboard.activeBatches).toBe('number');
      expect(typeof dashboard.totalBirds).toBe('number');
    }, TEST_TIMEOUT);

    test('should handle dashboard refresh without errors', async () => {
      const dashboard1 = await apiService.getDashboard();
      const dashboard2 = await apiService.getDashboard();

      expect(dashboard1).toBeTruthy();
      expect(dashboard2).toBeTruthy();
      // Both calls should succeed without throwing errors
    }, TEST_TIMEOUT);
  });

  describe('2.2 Farm Management', () => {
    test('should create a new farm successfully', async () => {
      const farmData = {
        farmName: `Integration Test Farm ${Date.now()}`,
        location: 'Kampala, Uganda',
        capacity: 5000,
        farmType: 'layers',
      };

      const farm = await apiService.createFarm(farmData);

      expect(farm).toBeTruthy();
      expect(farm.id).toBeTruthy();
      expect(farm.farmName).toBe(farmData.farmName);
      expect(farm.location).toBe(farmData.location);
      expect(farm.capacity).toBe(farmData.capacity);

      testContext.farm = farm;
    }, TEST_TIMEOUT);

    test('should retrieve all farms', async () => {
      const farms = await apiService.getFarms();

      expect(Array.isArray(farms)).toBe(true);
      expect(farms.length).toBeGreaterThan(0);

      // Our test farm should be in the list
      const ourFarm = farms.find(f => f.id === testContext.farm.id);
      expect(ourFarm).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should update farm details', async () => {
      const updatedData = {
        farmName: `Updated Farm ${Date.now()}`,
        capacity: 6000,
      };

      const updatedFarm = await apiService.updateFarm(testContext.farm.id, updatedData);

      expect(updatedFarm).toBeTruthy();
      expect(updatedFarm.farmName).toBe(updatedData.farmName);
      expect(updatedFarm.capacity).toBe(updatedData.capacity);

      testContext.farm = updatedFarm;
    }, TEST_TIMEOUT);

    test('should validate required fields when creating farm', async () => {
      await expect(
        apiService.createFarm({
          // Missing required fields
          location: 'Test Location',
        })
      ).rejects.toThrow();
    }, TEST_TIMEOUT);

    test('should handle farm name mapping correctly', async () => {
      const farms = await apiService.getFarms();

      // Every farm should have a 'name' property (mapped from farmName)
      farms.forEach(farm => {
        expect(farm.name).toBeTruthy();
      });
    }, TEST_TIMEOUT);
  });

  describe('2.3 Batch/Flock Management', () => {
    test('should create a new batch successfully', async () => {
      const batchData = {
        batchName: `Test Batch ${Date.now()}`,
        farmId: testContext.farm.id,
        batchNumber: `B${Date.now()}`,
        birdType: 'Layers',
        initialCount: 1000,
        startDate: new Date().toISOString().split('T')[0],
        status: 'active',
      };

      const batch = await apiService.createFlock(batchData);

      expect(batch).toBeTruthy();
      expect(batch.id).toBeTruthy();
      expect(batch.batchName).toBe(batchData.batchName);
      expect(batch.farmId).toBe(testContext.farm.id);
      expect(batch.initialCount).toBe(batchData.initialCount);

      testContext.batch = batch;
    }, TEST_TIMEOUT);

    test('should retrieve all batches', async () => {
      const batches = await apiService.getFlocks();

      expect(Array.isArray(batches)).toBe(true);
      expect(batches.length).toBeGreaterThan(0);

      // Our test batch should be in the list
      const ourBatch = batches.find(b => b.id === testContext.batch.id);
      expect(ourBatch).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should update batch details', async () => {
      const updatedData = {
        currentCount: 990, // Simulating some mortality
        status: 'active',
      };

      const updatedBatch = await apiService.updateFlock(testContext.batch.id, updatedData);

      expect(updatedBatch).toBeTruthy();
      expect(updatedBatch.currentCount).toBe(updatedData.currentCount);

      testContext.batch = updatedBatch;
    }, TEST_TIMEOUT);

    test('should handle batch name mapping correctly', async () => {
      const batches = await apiService.getFlocks();

      // Every batch should have a 'name' property
      batches.forEach(batch => {
        expect(batch.name).toBeTruthy();
      });
    }, TEST_TIMEOUT);

    test('should validate farm-batch relationship', async () => {
      // Try to create batch with invalid farm ID
      await expect(
        apiService.createFlock({
          batchName: 'Invalid Farm Batch',
          farmId: 99999, // Non-existent farm
          batchNumber: 'BINVALID',
          birdType: 'Broilers',
          initialCount: 500,
          startDate: new Date().toISOString().split('T')[0],
        })
      ).rejects.toThrow();
    }, TEST_TIMEOUT);
  });

  describe('2.4 Production Records', () => {
    test('should create a production record', async () => {
      const recordData = {
        batchId: testContext.batch.id,
        date: new Date().toISOString().split('T')[0],
        eggsCollected: 850,
        goodEggs: 820,
        brokenEggs: 20,
        deformedEggs: 10,
      };

      const record = await apiService.createProductionRecord(recordData);

      expect(record).toBeTruthy();
      expect(record.id).toBeTruthy();
      expect(record.batchId).toBe(testContext.batch.id);
      expect(record.eggsCollected).toBe(recordData.eggsCollected);

      testContext.productionRecord = record;
    }, TEST_TIMEOUT);

    test('should retrieve all production records', async () => {
      const records = await apiService.getProductionRecords();

      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);

      const ourRecord = records.find(r => r.id === testContext.productionRecord.id);
      expect(ourRecord).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should validate production record data', async () => {
      await expect(
        apiService.createProductionRecord({
          batchId: testContext.batch.id,
          date: new Date().toISOString().split('T')[0],
          eggsCollected: -10, // Invalid: negative value
        })
      ).rejects.toThrow();
    }, TEST_TIMEOUT);
  });

  describe('2.5 Mortality Records', () => {
    test('should create a mortality record', async () => {
      const recordData = {
        batchId: testContext.batch.id,
        date: new Date().toISOString().split('T')[0],
        mortalityCount: 10,
        cause: 'Disease',
        notes: 'Test mortality record',
      };

      const record = await apiService.createMortalityRecord(recordData);

      expect(record).toBeTruthy();
      expect(record.id).toBeTruthy();
      expect(record.batchId).toBe(testContext.batch.id);
      expect(record.mortalityCount).toBe(recordData.mortalityCount);

      testContext.mortalityRecord = record;
    }, TEST_TIMEOUT);

    test('should retrieve all mortality records', async () => {
      const records = await apiService.getMortalityRecords();

      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);

      const ourRecord = records.find(r => r.id === testContext.mortalityRecord.id);
      expect(ourRecord).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should update batch current count after mortality', async () => {
      // Get updated batch to verify current count decreased
      const batches = await apiService.getFlocks();
      const updatedBatch = batches.find(b => b.id === testContext.batch.id);

      // Current count should reflect mortality
      expect(updatedBatch.currentCount).toBeLessThan(testContext.batch.initialCount);
    }, TEST_TIMEOUT);
  });

  describe('2.6 Feed Records', () => {
    test('should create a feed record', async () => {
      const recordData = {
        batchId: testContext.batch.id,
        date: new Date().toISOString().split('T')[0],
        feedType: 'Layers Mash',
        quantity: 150,
        cost: 75000,
      };

      const record = await apiService.createFeedRecord(recordData);

      expect(record).toBeTruthy();
      expect(record.id).toBeTruthy();
      expect(record.batchId).toBe(testContext.batch.id);
      expect(record.quantity).toBe(recordData.quantity);

      testContext.feedRecord = record;
    }, TEST_TIMEOUT);

    test('should retrieve all feed records', async () => {
      const records = await apiService.getFeedRecords();

      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);

      const ourRecord = records.find(r => r.id === testContext.feedRecord.id);
      expect(ourRecord).toBeTruthy();
    }, TEST_TIMEOUT);
  });

  describe('2.7 Water Records', () => {
    test('should create a water record', async () => {
      const recordData = {
        batchId: testContext.batch.id,
        date: new Date().toISOString().split('T')[0],
        volume: 500, // liters
      };

      const record = await apiService.createWaterRecord(recordData);

      expect(record).toBeTruthy();
      expect(record.id).toBeTruthy();
      expect(record.batchId).toBe(testContext.batch.id);
      expect(record.volume).toBe(recordData.volume);

      testContext.waterRecord = record;
    }, TEST_TIMEOUT);

    test('should retrieve water records by batch', async () => {
      const records = await apiService.getWaterRecordsByBatch(testContext.batch.id);

      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);

      const ourRecord = records.find(r => r.id === testContext.waterRecord.id);
      expect(ourRecord).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should get water consumption summary', async () => {
      const summary = await apiService.getWaterRecordSummary(testContext.batch.id);

      expect(summary).toBeTruthy();
      expect(typeof summary.totalVolume).toBe('number');
    }, TEST_TIMEOUT);
  });

  describe('2.8 Weight Records', () => {
    test('should create a weight record', async () => {
      const recordData = {
        batchId: testContext.batch.id,
        date: new Date().toISOString().split('T')[0],
        averageWeight: 1.5, // kg
        sampleSize: 50,
      };

      const record = await apiService.createWeightRecord(recordData);

      expect(record).toBeTruthy();
      expect(record.id).toBeTruthy();
      expect(record.batchId).toBe(testContext.batch.id);
      expect(record.averageWeight).toBe(recordData.averageWeight);

      testContext.weightRecord = record;
    }, TEST_TIMEOUT);

    test('should retrieve weight records by batch', async () => {
      const records = await apiService.getWeightRecordsByBatch(testContext.batch.id);

      expect(Array.isArray(records)).toBe(true);
      expect(records.length).toBeGreaterThan(0);

      const ourRecord = records.find(r => r.id === testContext.weightRecord.id);
      expect(ourRecord).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should get weight trends', async () => {
      const trends = await apiService.getWeightTrends(testContext.batch.id);

      expect(trends).toBeTruthy();
      expect(Array.isArray(trends)).toBe(true);
    }, TEST_TIMEOUT);
  });

  describe('2.9 Data Persistence Verification', () => {
    test('should persist all created records in backend database', async () => {
      // Retrieve all data and verify it matches what we created
      const farms = await apiService.getFarms();
      const batches = await apiService.getFlocks();
      const productionRecords = await apiService.getProductionRecords();
      const mortalityRecords = await apiService.getMortalityRecords();
      const feedRecords = await apiService.getFeedRecords();
      const waterRecords = await apiService.getWaterRecords();
      const weightRecords = await apiService.getWeightRecords();

      expect(farms.find(f => f.id === testContext.farm.id)).toBeTruthy();
      expect(batches.find(b => b.id === testContext.batch.id)).toBeTruthy();
      expect(productionRecords.find(r => r.id === testContext.productionRecord.id)).toBeTruthy();
      expect(mortalityRecords.find(r => r.id === testContext.mortalityRecord.id)).toBeTruthy();
      expect(feedRecords.find(r => r.id === testContext.feedRecord.id)).toBeTruthy();
      expect(waterRecords.find(r => r.id === testContext.waterRecord.id)).toBeTruthy();
      expect(weightRecords.find(r => r.id === testContext.weightRecord.id)).toBeTruthy();
    }, TEST_TIMEOUT);

    test('should update dashboard metrics after creating records', async () => {
      const dashboard = await apiService.getDashboard();

      // Dashboard should reflect the farm and batch we created
      expect(dashboard.totalFarms).toBeGreaterThan(0);
      expect(dashboard.totalBatches).toBeGreaterThan(0);
      expect(dashboard.totalBirds).toBeGreaterThan(0);
    }, TEST_TIMEOUT);
  });

  describe('2.10 Delete Operations', () => {
    test('should delete production record', async () => {
      await apiService.deleteProductionRecord(testContext.productionRecord.id);

      const records = await apiService.getProductionRecords();
      const deleted = records.find(r => r.id === testContext.productionRecord.id);

      expect(deleted).toBeUndefined();
      testContext.productionRecord = null;
    }, TEST_TIMEOUT);

    test('should delete mortality record', async () => {
      await apiService.deleteMortalityRecord(testContext.mortalityRecord.id);

      const records = await apiService.getMortalityRecords();
      const deleted = records.find(r => r.id === testContext.mortalityRecord.id);

      expect(deleted).toBeUndefined();
      testContext.mortalityRecord = null;
    }, TEST_TIMEOUT);

    test('should delete feed record', async () => {
      await apiService.deleteFeedRecord(testContext.feedRecord.id);

      const records = await apiService.getFeedRecords();
      const deleted = records.find(r => r.id === testContext.feedRecord.id);

      expect(deleted).toBeUndefined();
      testContext.feedRecord = null;
    }, TEST_TIMEOUT);

    test('should delete water record', async () => {
      await apiService.deleteWaterRecord(testContext.waterRecord.id);

      const records = await apiService.getWaterRecords();
      const deleted = records.find(r => r.id === testContext.waterRecord.id);

      expect(deleted).toBeUndefined();
      testContext.waterRecord = null;
    }, TEST_TIMEOUT);

    test('should delete weight record', async () => {
      await apiService.deleteWeightRecord(testContext.weightRecord.id);

      const records = await apiService.getWeightRecords();
      const deleted = records.find(r => r.id === testContext.weightRecord.id);

      expect(deleted).toBeUndefined();
      testContext.weightRecord = null;
    }, TEST_TIMEOUT);

    test('should delete batch', async () => {
      await apiService.deleteFlock(testContext.batch.id);

      const batches = await apiService.getFlocks();
      const deleted = batches.find(b => b.id === testContext.batch.id);

      expect(deleted).toBeUndefined();
      testContext.batch = null;
    }, TEST_TIMEOUT);

    test('should delete farm', async () => {
      await apiService.deleteFarm(testContext.farm.id);

      const farms = await apiService.getFarms();
      const deleted = farms.find(f => f.id === testContext.farm.id);

      expect(deleted).toBeUndefined();
      testContext.farm = null;
    }, TEST_TIMEOUT);
  });
});
