import databaseService from './database';
import offlineDataService from './offlineDataService';

/**
 * Test script to verify SQLite database functionality
 * This script tests the database initialization and basic operations
 */

export const testDatabaseFunctionality = async () => {
  console.log('=== DATABASE FUNCTIONALITY TEST ===');

  try {
    console.log('1. Testing database initialization...');

    // Test database service initialization
    const initResult = await databaseService.init();
    if (!initResult) {
      throw new Error('Database initialization failed');
    }
    console.log('✓ Database service initialized successfully');

    // Test connectivity
    const isConnected = await databaseService.isConnected();
    if (!isConnected) {
      throw new Error('Database connectivity test failed');
    }
    console.log('✓ Database connectivity verified');

    console.log('2. Testing database operations...');

    // Test database operations
    const testResult = await databaseService.testDatabaseOperations();
    if (!testResult.success) {
      throw new Error(`Database operations test failed: ${testResult.error}`);
    }
    console.log(`✓ Database operations test passed (${testResult.tablesCount} tables created)`);

    console.log('3. Testing offline data service...');

    // Test offline data service initialization
    await offlineDataService.init();
    console.log('✓ Offline data service initialized successfully');

    console.log('4. Testing basic data operations...');

    // Test creating and retrieving data
    const testOrg = await offlineDataService.createOrganization({
      name: 'Test Organization',
      subscription_type: 'free'
    });
    console.log('✓ Test organization created:', testOrg.id);

    const organizations = await offlineDataService.getOrganizations();
    console.log('✓ Organizations retrieved:', organizations.length);

    // Test dashboard data
    const dashboardData = await offlineDataService.getDashboardData();
    console.log('✓ Dashboard data retrieved successfully');

    console.log('5. Testing storage stats...');

    // Test storage stats (this was failing before)
    try {
      const stats = {
        farms: await offlineDataService.count('farms'),
        batches: await offlineDataService.count('poultry_batches'),
        organizations: await offlineDataService.count('organizations')
      };
      console.log('✓ Storage stats retrieved successfully:', stats);
    } catch (error) {
      console.error('Storage stats test failed:', error);
      throw error;
    }

    console.log('=== ALL TESTS PASSED ===');
    console.log('Database is working correctly and ready for use');

    return {
      success: true,
      message: 'All database functionality tests passed',
      details: {
        initialization: true,
        connectivity: true,
        operations: true,
        offlineService: true,
        storageStats: true
      }
    };

  } catch (error) {
    console.error('=== DATABASE TEST FAILED ===');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);

    return {
      success: false,
      error: error.message,
      message: 'Database functionality test failed'
    };
  }
};

/**
 * Test specific database operations that were failing
 */
export const testSpecificIssues = async () => {
  console.log('=== TESTING SPECIFIC ISSUES ===');

  try {
    // Test the specific operations that were causing the original errors

    console.log('Testing storage stats (original error case)...');
    try {
      const stats = await offlineDataService.count('farms');
      console.log('✓ Storage stats working:', stats);
    } catch (error) {
      console.error('✗ Storage stats failed:', error.message);
      throw error;
    }

    console.log('Testing database preparation (original error case)...');
    try {
      const result = await databaseService.selectOne('sync_queue', 'COUNT(*) as count');
      console.log('✓ Database preparation working:', result);
    } catch (error) {
      console.error('✗ Database preparation failed:', error.message);
      throw error;
    }

    console.log('Testing function calls (original error case)...');
    try {
      const info = await databaseService.getDatabaseInfo();
      console.log('✓ Function calls working:', info.tables.length, 'tables found');
    } catch (error) {
      console.error('✗ Function calls failed:', error.message);
      throw error;
    }

    console.log('=== SPECIFIC ISSUES TESTS PASSED ===');
    return { success: true };

  } catch (error) {
    console.error('=== SPECIFIC ISSUES TEST FAILED ===');
    console.error('Error:', error.message);
    return { success: false, error: error.message };
  }
};

// Export default test function
export default testDatabaseFunctionality;