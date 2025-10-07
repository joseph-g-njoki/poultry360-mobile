import unifiedApiService from './unifiedApiService';
import offlineDataService from './offlineDataService';
import syncService from './syncService';
import networkService from './networkService';
import migrationService from './migrationService';

// Test suite for offline functionality
class OfflineFunctionalityTest {
  constructor() {
    this.testResults = [];
    this.testsPassed = 0;
    this.testsFailed = 0;
  }

  // Log test results
  logResult(testName, passed, message = '') {
    const result = {
      testName,
      passed,
      message,
      timestamp: new Date().toISOString()
    };

    this.testResults.push(result);

    if (passed) {
      this.testsPassed++;
      console.log(`✅ ${testName}: PASSED ${message ? '- ' + message : ''}`);
    } else {
      this.testsFailed++;
      console.error(`❌ ${testName}: FAILED ${message ? '- ' + message : ''}`);
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🚀 Starting Offline Functionality Tests...\n');

    this.testResults = [];
    this.testsPassed = 0;
    this.testsFailed = 0;

    try {
      // Database tests
      await this.testDatabaseInitialization();
      await this.testDatabaseOperations();

      // Migration tests
      await this.testMigrationSystem();

      // Offline data service tests
      await this.testOfflineDataOperations();

      // Sync service tests
      await this.testSyncQueueOperations();

      // Network service tests
      await this.testNetworkDetection();

      // Unified API service tests
      await this.testUnifiedApiService();

      // Integration tests
      await this.testOfflineToOnlineSync();

      this.printTestSummary();

    } catch (error) {
      console.error('Test suite failed with error:', error);
      this.logResult('Test Suite Execution', false, error.message);
    }

    return this.getTestSummary();
  }

  // Test database initialization
  async testDatabaseInitialization() {
    try {
      await offlineDataService.init();
      const dbInfo = await offlineDataService.db.getDatabaseInfo();

      this.logResult(
        'Database Initialization',
        dbInfo && dbInfo.tables.length > 0,
        `Created ${dbInfo.tables.length} tables`
      );

      // Test table creation
      const expectedTables = [
        'sync_queue',
        'organizations',
        'users',
        'farms',
        'poultry_batches',
        'feed_records',
        'production_records',
        'mortality_records',
        'health_records'
      ];

      const missingTables = expectedTables.filter(table => !dbInfo.tables.includes(table));

      this.logResult(
        'Database Tables Created',
        missingTables.length === 0,
        missingTables.length > 0 ? `Missing tables: ${missingTables.join(', ')}` : 'All tables created'
      );

    } catch (error) {
      this.logResult('Database Initialization', false, error.message);
    }
  }

  // Test basic database operations
  async testDatabaseOperations() {
    try {
      // Test INSERT
      const testFarm = {
        farm_name: 'Test Farm',
        location: 'Test Location',
        farm_size: 100,
        contact_person: 'Test Contact',
        phone_number: '123-456-7890',
        notes: 'Test farm for offline functionality'
      };

      const farmResult = await offlineDataService.createFarm(testFarm);

      this.logResult(
        'Database INSERT Operation',
        farmResult && farmResult.id,
        farmResult ? `Created farm with ID: ${farmResult.id}` : 'Failed to create farm'
      );

      if (farmResult && farmResult.id) {
        // Test SELECT
        const retrievedFarm = await offlineDataService.getById('farms', farmResult.id);

        this.logResult(
          'Database SELECT Operation',
          retrievedFarm && retrievedFarm.farm_name === testFarm.farm_name,
          retrievedFarm ? 'Farm retrieved successfully' : 'Failed to retrieve farm'
        );

        // Test UPDATE
        if (retrievedFarm) {
          await offlineDataService.updateFarm(farmResult.id, {
            farm_name: 'Updated Test Farm',
            notes: 'Updated notes'
          });

          const updatedFarm = await offlineDataService.getById('farms', farmResult.id);

          this.logResult(
            'Database UPDATE Operation',
            updatedFarm && updatedFarm.farm_name === 'Updated Test Farm',
            updatedFarm ? 'Farm updated successfully' : 'Failed to update farm'
          );

          // Test DELETE
          await offlineDataService.deleteFarm(farmResult.id);
          const deletedFarm = await offlineDataService.getById('farms', farmResult.id);

          this.logResult(
            'Database DELETE Operation (Soft Delete)',
            deletedFarm && deletedFarm.is_deleted === 1,
            deletedFarm ? 'Farm soft deleted successfully' : 'Failed to soft delete farm'
          );
        }
      }

    } catch (error) {
      this.logResult('Database Operations', false, error.message);
    }
  }

  // Test migration system
  async testMigrationSystem() {
    try {
      const migrationStatus = await migrationService.getMigrationStatus();

      this.logResult(
        'Migration Status Check',
        migrationStatus && typeof migrationStatus.currentVersion === 'number',
        `Current version: ${migrationStatus.currentVersion}, Target: ${migrationStatus.targetVersion}`
      );

      this.logResult(
        'Migration Up-to-date Check',
        migrationStatus.isUpToDate,
        migrationStatus.isUpToDate ? 'Database is up to date' : 'Migration needed'
      );

      // Test integrity check
      const integrityResults = await migrationService.performIntegrityCheck();

      this.logResult(
        'Data Integrity Check',
        integrityResults && typeof integrityResults.orphanedRecords === 'number',
        `Found ${integrityResults.orphanedRecords} orphaned records, ${integrityResults.errors.length} errors`
      );

    } catch (error) {
      this.logResult('Migration System', false, error.message);
    }
  }

  // Test offline data operations
  async testOfflineDataOperations() {
    try {
      // Create test data
      const testFarm = await offlineDataService.createFarm({
        farm_name: 'Offline Test Farm',
        location: 'Offline Location'
      });

      const testBatch = await offlineDataService.createBatch({
        batch_name: 'Offline Test Batch',
        initial_count: 100,
        current_count: 100,
        farm_id: testFarm.id
      });

      this.logResult(
        'Offline Data Creation',
        testFarm && testBatch,
        `Created farm (${testFarm.id}) and batch (${testBatch.id})`
      );

      // Test relationships
      const batchesForFarm = await offlineDataService.getBatchesByFarm(testFarm.id);

      this.logResult(
        'Offline Data Relationships',
        batchesForFarm && batchesForFarm.length === 1,
        `Found ${batchesForFarm?.length || 0} batches for farm`
      );

      // Test record creation
      const testFeedRecord = await offlineDataService.createFeedRecord({
        batch_id: testBatch.id,
        feed_type: 'Starter',
        quantity_kg: 50,
        cost_per_kg: 25,
        total_cost: 1250,
        date: new Date().toISOString().split('T')[0]
      });

      this.logResult(
        'Offline Record Creation',
        testFeedRecord && testFeedRecord.id,
        `Created feed record with ID: ${testFeedRecord.id}`
      );

      // Clean up test data
      if (testFeedRecord) await offlineDataService.deleteFeedRecord(testFeedRecord.id);
      if (testBatch) await offlineDataService.deleteBatch(testBatch.id);
      if (testFarm) await offlineDataService.deleteFarm(testFarm.id);

    } catch (error) {
      this.logResult('Offline Data Operations', false, error.message);
    }
  }

  // Test sync queue operations
  async testSyncQueueOperations() {
    try {
      // Create test data that will be added to sync queue
      const testFarm = await offlineDataService.createFarm({
        farm_name: 'Sync Test Farm',
        location: 'Sync Location'
      });

      // Check if sync queue item was created
      const syncQueue = await offlineDataService.getSyncQueue('pending');
      const farmSyncItem = syncQueue.find(item =>
        item.table_name === 'farms' &&
        item.operation === 'CREATE' &&
        item.local_id === testFarm.id
      );

      this.logResult(
        'Sync Queue Creation',
        farmSyncItem !== undefined,
        farmSyncItem ? 'Sync queue item created for farm' : 'No sync queue item found'
      );

      // Test sync status updates
      if (farmSyncItem) {
        await offlineDataService.updateSyncQueueStatus(farmSyncItem.id, 'syncing');

        const updatedItem = await offlineDataService.selectOne('sync_queue', '*', 'id = ?', [farmSyncItem.id]);

        this.logResult(
          'Sync Queue Status Update',
          updatedItem && updatedItem.sync_status === 'syncing',
          `Status updated to: ${updatedItem?.sync_status}`
        );
      }

      // Test sync status retrieval
      const syncStatus = await syncService.getSyncStatus();

      this.logResult(
        'Sync Status Retrieval',
        syncStatus && typeof syncStatus.pendingCount === 'number',
        `Pending: ${syncStatus.pendingCount}, Failed: ${syncStatus.failedCount}`
      );

      // Clean up
      if (testFarm) await offlineDataService.deleteFarm(testFarm.id);

    } catch (error) {
      this.logResult('Sync Queue Operations', false, error.message);
    }
  }

  // Test network detection
  async testNetworkDetection() {
    try {
      await networkService.init();

      const connectionState = networkService.getConnectionState();

      this.logResult(
        'Network State Detection',
        connectionState && typeof connectionState.isConnected === 'boolean',
        `Connected: ${connectionState.isConnected}, Type: ${connectionState.connectionType}`
      );

      const connectionStats = await networkService.getConnectionStats();

      this.logResult(
        'Network Statistics',
        connectionStats && typeof connectionStats.isConnected === 'boolean',
        `Quality: ${connectionStats.connectionQuality || 'unknown'}`
      );

    } catch (error) {
      this.logResult('Network Detection', false, error.message);
    }
  }

  // Test unified API service
  async testUnifiedApiService() {
    try {
      // Force offline mode for testing
      unifiedApiService.setForceOfflineMode(true);

      // Test offline farm creation
      const farmResult = await unifiedApiService.createFarm({
        farmName: 'Unified API Test Farm',
        location: 'API Test Location'
      });

      this.logResult(
        'Unified API Offline Creation',
        farmResult.success && farmResult.source === 'local',
        `Created farm offline: ${farmResult.success}, Source: ${farmResult.source}`
      );

      // Test offline farm retrieval
      const farmsResult = await unifiedApiService.getFarms();

      this.logResult(
        'Unified API Offline Retrieval',
        farmsResult.success && Array.isArray(farmsResult.data),
        `Retrieved ${farmsResult.data?.length || 0} farms offline`
      );

      // Test connection state
      const connectionState = unifiedApiService.getConnectionState();

      this.logResult(
        'Unified API Connection State',
        connectionState && typeof connectionState.isOnline === 'boolean',
        `Online: ${connectionState.isOnline}, Offline: ${connectionState.isOffline}`
      );

      // Reset offline mode
      unifiedApiService.setForceOfflineMode(false);

    } catch (error) {
      this.logResult('Unified API Service', false, error.message);
    }
  }

  // Test offline to online sync simulation
  async testOfflineToOnlineSync() {
    try {
      // This test simulates the offline-to-online sync process
      // In a real environment, this would require actual network connectivity

      const storageStats = await unifiedApiService.getStorageStats();

      this.logResult(
        'Storage Statistics',
        storageStats && typeof storageStats.total === 'number',
        `Total records: ${storageStats.total}, Pending sync: ${storageStats.pendingSync}`
      );

      // Test backup creation
      const backupKey = await unifiedApiService.createBackup();

      this.logResult(
        'Backup Creation',
        backupKey && backupKey.startsWith('backup_'),
        backupKey ? `Created backup: ${backupKey}` : 'Backup creation failed'
      );

      // Test data export
      const exportedData = await unifiedApiService.exportData();

      this.logResult(
        'Data Export',
        exportedData && typeof exportedData === 'object',
        `Exported ${Object.keys(exportedData).length} data types`
      );

    } catch (error) {
      this.logResult('Offline to Online Sync', false, error.message);
    }
  }

  // Print test summary
  printTestSummary() {
    const totalTests = this.testsPassed + this.testsFailed;
    const successRate = totalTests > 0 ? ((this.testsPassed / totalTests) * 100).toFixed(1) : 0;

    console.log('\n📊 Test Summary:');
    console.log(`Total Tests: ${totalTests}`);
    console.log(`Passed: ${this.testsPassed}`);
    console.log(`Failed: ${this.testsFailed}`);
    console.log(`Success Rate: ${successRate}%`);

    if (this.testsFailed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(result => !result.passed)
        .forEach(result => {
          console.log(`  - ${result.testName}: ${result.message}`);
        });
    }

    if (successRate >= 80) {
      console.log('\n🎉 Offline functionality is working well!');
    } else if (successRate >= 60) {
      console.log('\n⚠️  Offline functionality has some issues but is mostly functional.');
    } else {
      console.log('\n🚨 Offline functionality has significant issues that need attention.');
    }
  }

  // Get test summary
  getTestSummary() {
    const totalTests = this.testsPassed + this.testsFailed;
    const successRate = totalTests > 0 ? ((this.testsPassed / totalTests) * 100) : 0;

    return {
      totalTests,
      passed: this.testsPassed,
      failed: this.testsFailed,
      successRate,
      results: this.testResults,
      timestamp: new Date().toISOString()
    };
  }

  // Clean test data (helper method)
  async cleanTestData() {
    try {
      console.log('🧹 Cleaning up test data...');

      // Delete test farms
      const testFarms = await offlineDataService.getWhere(
        'farms',
        "farm_name LIKE '%Test%' OR farm_name LIKE '%Sync%' OR farm_name LIKE '%Offline%' OR farm_name LIKE '%Unified%'"
      );

      for (const farm of testFarms) {
        await offlineDataService.hardDelete('farms', farm.id);
      }

      // Clean sync queue test items
      await offlineDataService.delete('sync_queue', "table_name = 'farms' AND operation = 'CREATE'");

      console.log(`Cleaned up ${testFarms.length} test farms and related data`);

    } catch (error) {
      console.error('Error cleaning test data:', error);
    }
  }

  // Performance test
  async testPerformance() {
    console.log('⏱️  Running Performance Tests...\n');

    try {
      // Test database insert performance
      const startTime = Date.now();
      const testData = [];

      for (let i = 0; i < 100; i++) {
        const farm = await offlineDataService.createFarm({
          farm_name: `Perf Test Farm ${i}`,
          location: `Location ${i}`,
          farm_size: Math.floor(Math.random() * 1000) + 100
        });
        testData.push(farm.id);
      }

      const insertTime = Date.now() - startTime;

      this.logResult(
        'Database Insert Performance',
        insertTime < 5000, // Should complete in under 5 seconds
        `100 inserts completed in ${insertTime}ms`
      );

      // Test database select performance
      const selectStartTime = Date.now();
      const allFarms = await offlineDataService.getFarms();
      const selectTime = Date.now() - selectStartTime;

      this.logResult(
        'Database Select Performance',
        selectTime < 1000, // Should complete in under 1 second
        `Selected ${allFarms.length} farms in ${selectTime}ms`
      );

      // Clean up performance test data
      for (const farmId of testData) {
        await offlineDataService.hardDelete('farms', farmId);
      }

    } catch (error) {
      this.logResult('Performance Test', false, error.message);
    }
  }
}

// Export test runner
export const testOfflineFunctionality = async () => {
  const testRunner = new OfflineFunctionalityTest();
  return await testRunner.runAllTests();
};

export const testOfflinePerformance = async () => {
  const testRunner = new OfflineFunctionalityTest();
  return await testRunner.testPerformance();
};

export const cleanTestData = async () => {
  const testRunner = new OfflineFunctionalityTest();
  return await testRunner.cleanTestData();
};

export default OfflineFunctionalityTest;