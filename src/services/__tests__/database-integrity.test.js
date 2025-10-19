/**
 * Comprehensive Database Integrity Test for Poultry360
 * Tests all entity relationships and ID synchronization
 */

import fastDatabase from '../fastDatabase';

describe('Database Integrity Tests', () => {
  beforeAll(() => {
    // Initialize database
    fastDatabase.init();
  });

  describe('Farm CRUD Operations', () => {
    let testFarmId;

    test('should create a farm with all sync columns', () => {
      const farmData = {
        name: 'Test Farm 1',
        location: 'Test Location',
        farmType: 'broiler',
        description: 'Test farm for integrity tests'
      };

      const result = fastDatabase.createFarm(farmData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.needs_sync).toBe(1);
      expect(result.server_id).toBeNull();

      testFarmId = result.id;
      console.log('✅ Created test farm with ID:', testFarmId);
    });

    test('should retrieve the created farm', () => {
      const farms = fastDatabase.getFarms();

      expect(Array.isArray(farms)).toBe(true);
      expect(farms.length).toBeGreaterThan(0);

      const testFarm = farms.find(f => f.id === testFarmId);
      expect(testFarm).toBeDefined();
      expect(testFarm.farm_name).toBe('Test Farm 1');

      console.log('✅ Retrieved farm:', testFarm);
    });

    test('should update farm and maintain ID', () => {
      const updateData = {
        name: 'Updated Test Farm',
        location: 'Updated Location',
        farmType: 'layer',
        description: 'Updated description'
      };

      const result = fastDatabase.updateFarm(testFarmId, updateData);

      expect(result).toBeDefined();
      expect(result.id).toBe(testFarmId);
      expect(result.name).toBe('Updated Test Farm');

      console.log('✅ Updated farm, ID preserved:', result.id);
    });
  });

  describe('Batch Creation with Farm Relationship', () => {
    let farmId;
    let batchId;

    beforeAll(() => {
      // Create a farm for batch tests
      const farm = fastDatabase.createFarm({
        name: 'Batch Test Farm',
        location: 'Test Location',
        farmType: 'broiler'
      });
      farmId = farm.id;
      console.log('✅ Created farm for batch tests, ID:', farmId);
    });

    test('should create batch linked to existing farm', () => {
      const batchData = {
        batchName: 'Test Batch 1',
        farmId: farmId,
        birdType: 'Broiler',
        initialCount: 1000,
        currentCount: 1000,
        arrivalDate: new Date().toISOString(),
        status: 'active'
      };

      const result = fastDatabase.createBatch(batchData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.farmId).toBe(farmId);
      expect(result.needs_sync).toBe(1);

      batchId = result.id;
      console.log('✅ Created batch with ID:', batchId, 'linked to farm:', farmId);
    });

    test('should retrieve batch with farm relationship intact', () => {
      const batches = fastDatabase.getBatches();

      expect(Array.isArray(batches)).toBe(true);

      const testBatch = batches.find(b => b.id === batchId);
      expect(testBatch).toBeDefined();
      expect(testBatch.farm_id).toBe(farmId);

      console.log('✅ Retrieved batch with farm_id:', testBatch.farm_id);
    });

    test('should fail to create batch with invalid farmId', () => {
      const batchData = {
        batchName: 'Invalid Batch',
        farmId: 99999, // Non-existent farm
        birdType: 'Broiler',
        initialCount: 1000,
        arrivalDate: new Date().toISOString()
      };

      expect(() => {
        fastDatabase.createBatch(batchData);
      }).toThrow('Farm with ID 99999 not found');

      console.log('✅ Correctly rejected batch with invalid farmId');
    });
  });

  describe('Records Creation with Batch Relationship', () => {
    let farmId;
    let batchId;

    beforeAll(() => {
      // Create farm and batch for record tests
      const farm = fastDatabase.createFarm({
        name: 'Records Test Farm',
        location: 'Test Location',
        farmType: 'layer'
      });
      farmId = farm.id;

      const batch = fastDatabase.createBatch({
        batchName: 'Records Test Batch',
        farmId: farmId,
        birdType: 'Layer',
        initialCount: 500,
        arrivalDate: new Date().toISOString()
      });
      batchId = batch.id;

      console.log('✅ Created farm:', farmId, 'and batch:', batchId, 'for record tests');
    });

    test('should create feed record linked to batch', () => {
      const recordData = {
        batchId: batchId,
        feedType: 'Layer Feed',
        quantity: 50,
        cost: 2500,
        date: new Date().toISOString(),
        notes: 'Test feed record'
      };

      const result = fastDatabase.createRecord('feed', recordData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.batch_id).toBe(batchId);

      console.log('✅ Created feed record with ID:', result.id);
    });

    test('should create mortality record linked to batch', () => {
      const recordData = {
        batchId: batchId,
        count: 5,
        cause: 'Natural causes',
        date: new Date().toISOString(),
        notes: 'Test mortality record'
      };

      const result = fastDatabase.createRecord('mortality', recordData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.batch_id).toBe(batchId);

      console.log('✅ Created mortality record with ID:', result.id);
    });

    test('should create production record linked to batch', () => {
      const recordData = {
        batchId: batchId,
        eggsCollected: 450,
        brokenEggs: 10,
        abnormalEggs: 5,
        date: new Date().toISOString(),
        notes: 'Test production record'
      };

      const result = fastDatabase.createRecord('production', recordData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.batch_id).toBe(batchId);

      console.log('✅ Created production record with ID:', result.id);
    });

    test('should create health record linked to batch', () => {
      const recordData = {
        batchId: batchId,
        healthStatus: 'healthy',
        symptoms: 'None',
        treatment: 'Routine checkup',
        medication: 'Vitamins',
        date: new Date().toISOString(),
        notes: 'Test health record'
      };

      const result = fastDatabase.createRecord('health', recordData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.batch_id).toBe(batchId);

      console.log('✅ Created health record with ID:', result.id);
    });

    test('should create water record linked to batch', () => {
      const recordData = {
        batchId: batchId,
        quantityLiters: 200,
        waterSource: 'Municipal',
        quality: 'Good',
        temperature: 20,
        date: new Date().toISOString(),
        notes: 'Test water record'
      };

      const result = fastDatabase.createWaterRecord(recordData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.batch_id).toBe(batchId);

      console.log('✅ Created water record with ID:', result.id);
    });

    test('should create weight record linked to batch', () => {
      const recordData = {
        batchId: batchId,
        sampleSize: 10,
        averageWeight: 1.5,
        minWeight: 1.2,
        maxWeight: 1.8,
        date: new Date().toISOString(),
        notes: 'Test weight record'
      };

      const result = fastDatabase.createWeightRecord(recordData);

      expect(result).toBeDefined();
      expect(result.id).toBeDefined();
      expect(result.batch_id).toBe(batchId);

      console.log('✅ Created weight record with ID:', result.id);
    });
  });

  describe('Cascade Delete Integrity', () => {
    let farmId;
    let batchId;

    beforeAll(() => {
      // Create farm, batch, and records
      const farm = fastDatabase.createFarm({
        name: 'Delete Test Farm',
        location: 'Test Location',
        farmType: 'broiler'
      });
      farmId = farm.id;

      const batch = fastDatabase.createBatch({
        batchName: 'Delete Test Batch',
        farmId: farmId,
        birdType: 'Broiler',
        initialCount: 100,
        arrivalDate: new Date().toISOString()
      });
      batchId = batch.id;

      // Create a record
      fastDatabase.createRecord('feed', {
        batchId: batchId,
        feedType: 'Starter',
        quantity: 10,
        date: new Date().toISOString()
      });

      console.log('✅ Created farm:', farmId, ', batch:', batchId, 'for delete tests');
    });

    test('should delete farm and cascade to batch', () => {
      // Delete the farm
      const result = fastDatabase.deleteFarm(farmId);
      expect(result).toBe(true);

      // Verify farm is deleted
      const farms = fastDatabase.getFarms();
      const deletedFarm = farms.find(f => f.id === farmId);
      expect(deletedFarm).toBeUndefined();

      // Verify batch is also deleted (cascade)
      const batches = fastDatabase.getBatches();
      const deletedBatch = batches.find(b => b.id === batchId);
      expect(deletedBatch).toBeUndefined();

      console.log('✅ Cascade delete worked correctly');
    });
  });

  describe('Sync Column Validation', () => {
    test('all farms should have sync columns', () => {
      const farms = fastDatabase.getFarms();

      if (farms.length > 0) {
        farms.forEach(farm => {
          expect(farm).toHaveProperty('server_id');
          expect(farm).toHaveProperty('needs_sync');
          expect(farm).toHaveProperty('synced_at');
          expect(farm).toHaveProperty('created_at');
          expect(farm).toHaveProperty('updated_at');
        });
        console.log('✅ All farms have sync columns');
      }
    });

    test('all batches should have sync columns and server_farm_id', () => {
      const batches = fastDatabase.getBatches();

      if (batches.length > 0) {
        batches.forEach(batch => {
          expect(batch).toHaveProperty('server_id');
          expect(batch).toHaveProperty('server_farm_id');
          expect(batch).toHaveProperty('needs_sync');
          expect(batch).toHaveProperty('synced_at');
          expect(batch).toHaveProperty('created_at');
          expect(batch).toHaveProperty('updated_at');
        });
        console.log('✅ All batches have sync columns including server_farm_id');
      }
    });
  });

  describe('ID Mapping Simulation', () => {
    test('should handle server ID mapping correctly', () => {
      // Create a farm
      const farm = fastDatabase.createFarm({
        name: 'Sync Test Farm',
        location: 'Test Location',
        farmType: 'broiler'
      });
      const localFarmId = farm.id;

      // Simulate sync - mark as synced with server ID
      const mockServerId = '42';
      fastDatabase.markAsSynced('farms', localFarmId, mockServerId);

      // Verify sync worked
      const farms = fastDatabase.getFarms();
      const syncedFarm = farms.find(f => f.id === localFarmId);

      expect(syncedFarm).toBeDefined();
      expect(syncedFarm.server_id).toBe(mockServerId);
      expect(syncedFarm.needs_sync).toBe(0);
      expect(syncedFarm.synced_at).toBeDefined();

      console.log('✅ Server ID mapping working correctly');
      console.log('   Local ID:', localFarmId, '→ Server ID:', mockServerId);
    });

    test('should find record by server ID', () => {
      // Create a farm and mark as synced
      const farm = fastDatabase.createFarm({
        name: 'Find By Server ID Test',
        location: 'Test Location',
        farmType: 'layer'
      });
      const localId = farm.id;
      const serverId = 'test-server-123';

      fastDatabase.markAsSynced('farms', localId, serverId);

      // Find by server ID
      const found = fastDatabase.getRecordByServerId('farms', serverId);

      expect(found).toBeDefined();
      expect(found.id).toBe(localId);
      expect(found.server_id).toBe(serverId);

      console.log('✅ getRecordByServerId working correctly');
    });

    test('should get unsynced records', () => {
      // Create an unsynced farm
      const farm = fastDatabase.createFarm({
        name: 'Unsynced Test Farm',
        location: 'Test Location',
        farmType: 'broiler'
      });

      const unsyncedRecords = fastDatabase.getUnsyncedRecords('farms');

      expect(Array.isArray(unsyncedRecords)).toBe(true);

      const newFarm = unsyncedRecords.find(f => f.id === farm.id);
      expect(newFarm).toBeDefined();
      expect(newFarm.needs_sync).toBe(1);

      console.log('✅ getUnsyncedRecords working correctly');
      console.log('   Found', unsyncedRecords.length, 'unsynced farms');
    });
  });
});

// Run this test manually
console.log('');
console.log('═══════════════════════════════════════════════════');
console.log('🧪 DATABASE INTEGRITY TEST SUITE');
console.log('═══════════════════════════════════════════════════');
console.log('Run with: npm test database-integrity.test.js');
console.log('Or manually in your app with fastDatabase methods');
console.log('═══════════════════════════════════════════════════');
