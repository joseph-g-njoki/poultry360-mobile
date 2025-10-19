/**
 * Database System Test Suite
 *
 * This script tests the complete database system including:
 * - Database initialization
 * - Table creation
 * - Demo user seeding
 * - Login functionality
 * - Error recovery
 */

import fastDatabaseImport from './fastDatabase';
import offlineDataService from './offlineDataService';
import migrationService from './migrationService';
import unifiedApiService from './unifiedApiService';

// FIX: Handle both default and named exports from fastDatabase
const databaseService = fastDatabaseImport.default || fastDatabaseImport;

class DatabaseSystemTester {
  constructor() {
    this.testResults = [];
    this.totalTests = 0;
    this.passedTests = 0;
    this.failedTests = 0;
  }

  // Log test result
  logTest(testName, passed, message = '', details = null) {
    this.totalTests++;
    const result = {
      testName,
      passed,
      message,
      details,
      timestamp: new Date().toISOString()
    };

    this.testResults.push(result);

    if (passed) {
      this.passedTests++;
      console.log(`✅ ${testName}: ${message}`);
    } else {
      this.failedTests++;
      console.error(`❌ ${testName}: ${message}`);
      if (details) {
        console.error('   Details:', details);
      }
    }
  }

  // Run all tests
  async runAllTests() {
    console.log('🧪 Starting Database System Test Suite...');
    console.log('='.repeat(50));

    try {
      // Test 1: Database Service Initialization
      await this.testDatabaseServiceInit();

      // Test 2: Database Health Check
      await this.testDatabaseHealth();

      // Test 3: Offline Data Service Initialization
      await this.testOfflineDataServiceInit();

      // Test 4: Migration Service
      await this.testMigrationService();

      // Test 5: Demo Users
      await this.testDemoUsers();

      // Test 6: Unified API Service
      await this.testUnifiedApiService();

      // Test 7: Demo Login
      await this.testDemoLogin();

      // Test 8: Error Recovery
      await this.testErrorRecovery();

      // Test 9: Data Integrity
      await this.testDataIntegrity();

      // Test 10: Performance
      await this.testPerformance();

    } catch (error) {
      console.error('🚨 Test suite crashed:', error);
      this.logTest('Test Suite Execution', false, `Suite crashed: ${error.message}`, error);
    }

    // Print final results
    this.printResults();
  }

  // Test 1: Database Service Initialization
  async testDatabaseServiceInit() {
    try {
      console.log('🔧 Testing Database Service Initialization...');

      // Test initialization
      const initResult = await databaseService.init();
      this.logTest('Database Init', initResult === true, 'Database initialized successfully');

      // Test connectivity
      const isConnected = await databaseService.isConnected();
      this.logTest('Database Connectivity', isConnected, 'Database connection verified');

      // Test database info
      const dbInfo = await databaseService.getDatabaseInfo();
      this.logTest('Database Info', dbInfo && dbInfo.tables && dbInfo.tables.length > 0,
        `Database info retrieved (${dbInfo?.tables?.length || 0} tables)`, dbInfo);

      // Test database operations
      const operationsTest = await databaseService.testDatabaseOperations();
      this.logTest('Database Operations', operationsTest.success,
        operationsTest.message, operationsTest);

    } catch (error) {
      this.logTest('Database Service Init', false, error.message, error);
    }
  }

  // Test 2: Database Health Check
  async testDatabaseHealth() {
    try {
      console.log('🏥 Testing Database Health...');

      const healthCheck = await databaseService.healthCheck();
      this.logTest('Database Health', healthCheck.isHealthy,
        healthCheck.isHealthy ? 'Database is healthy' : `Health issues: ${healthCheck.error}`,
        healthCheck);

    } catch (error) {
      this.logTest('Database Health', false, error.message, error);
    }
  }

  // Test 3: Offline Data Service Initialization
  async testOfflineDataServiceInit() {
    try {
      console.log('💾 Testing Offline Data Service...');

      const initResult = await offlineDataService.init();
      this.logTest('Offline Data Service Init', initResult === true, 'Offline data service initialized');

      // Test data validation
      const validation = await offlineDataService.validateData();
      this.logTest('Data Validation', validation.isValid || validation.warnings.length === 0,
        `Data validation: ${validation.isValid ? 'valid' : 'warnings found'}`, validation);

    } catch (error) {
      this.logTest('Offline Data Service', false, error.message, error);
    }
  }

  // Test 4: Migration Service
  async testMigrationService() {
    try {
      console.log('🔄 Testing Migration Service...');

      const migrationStatus = await migrationService.getMigrationStatus();
      this.logTest('Migration Status', migrationStatus.isUpToDate,
        `Migration status: ${migrationStatus.isUpToDate ? 'up to date' : 'needs migration'}`,
        migrationStatus);

    } catch (error) {
      this.logTest('Migration Service', false, error.message, error);
    }
  }

  // Test 5: Demo Users
  async testDemoUsers() {
    try {
      console.log('👤 Testing Demo Users...');

      const demoEmails = ['demo@poultry360.com', 'owner@poultry360.com', 'admin@poultry360.com'];
      let foundUsers = 0;

      for (const email of demoEmails) {
        const user = await offlineDataService.getUserByEmail(email);
        if (user) {
          foundUsers++;
          this.logTest(`Demo User ${email}`, true, 'Demo user found in database', user);
        } else {
          this.logTest(`Demo User ${email}`, false, 'Demo user not found in database');
        }
      }

      this.logTest('All Demo Users', foundUsers === demoEmails.length,
        `${foundUsers}/${demoEmails.length} demo users found`);

    } catch (error) {
      this.logTest('Demo Users', false, error.message, error);
    }
  }

  // Test 6: Unified API Service
  async testUnifiedApiService() {
    try {
      console.log('🔗 Testing Unified API Service...');

      const initResult = await unifiedApiService.init();
      this.logTest('Unified API Init', initResult === true, 'Unified API service initialized');

      // Test connection state
      const connectionState = unifiedApiService.getConnectionState();
      this.logTest('Connection State', connectionState !== null,
        `Connection state retrieved`, connectionState);

    } catch (error) {
      this.logTest('Unified API Service', false, error.message, error);
    }
  }

  // Test 7: Demo Login
  async testDemoLogin() {
    try {
      console.log('🔐 Testing Demo Login...');

      const demoCredentials = [
        { email: 'demo@poultry360.com', password: 'demo123' },
        { email: 'owner@poultry360.com', password: 'owner123' },
        { email: 'admin@poultry360.com', password: 'admin123' }
      ];

      for (const cred of demoCredentials) {
        try {
          const loginResult = await unifiedApiService.login(cred.email, cred.password);

          if (loginResult.success) {
            this.logTest(`Login ${cred.email}`, true,
              `Login successful (${loginResult.source})`,
              { source: loginResult.source, isDemoUser: loginResult.isDemoUser });
          } else {
            this.logTest(`Login ${cred.email}`, false,
              `Login failed: ${loginResult.error}`, loginResult);
          }
        } catch (loginError) {
          this.logTest(`Login ${cred.email}`, false,
            `Login error: ${loginError.message}`, loginError);
        }
      }

    } catch (error) {
      this.logTest('Demo Login', false, error.message, error);
    }
  }

  // Test 8: Error Recovery
  async testErrorRecovery() {
    try {
      console.log('🚨 Testing Error Recovery...');

      // Test database recovery
      try {
        await databaseService.emergencyRecovery();
        this.logTest('Database Recovery', true, 'Emergency recovery completed');
      } catch (recoveryError) {
        this.logTest('Database Recovery', false, recoveryError.message, recoveryError);
      }

    } catch (error) {
      this.logTest('Error Recovery', false, error.message, error);
    }
  }

  // Test 9: Data Integrity
  async testDataIntegrity() {
    try {
      console.log('🔍 Testing Data Integrity...');

      const validation = await offlineDataService.validateData();

      this.logTest('Data Integrity Check', validation.isValid,
        `Integrity check: ${validation.isValid ? 'passed' : 'issues found'}`, validation);

      // Test database statistics
      const stats = await unifiedApiService.getStorageStats();
      this.logTest('Storage Statistics', stats !== null,
        `Storage stats retrieved`, stats);

    } catch (error) {
      this.logTest('Data Integrity', false, error.message, error);
    }
  }

  // Test 10: Performance
  async testPerformance() {
    try {
      console.log('⚡ Testing Performance...');

      // Test database operations performance
      const startTime = Date.now();

      // Perform a series of operations
      await databaseService.select('users', 'COUNT(*) as count');
      await databaseService.select('farms', 'COUNT(*) as count');
      await databaseService.select('poultry_batches', 'COUNT(*) as count');

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Performance should be under 1 second for basic operations
      const isPerformant = duration < 1000;

      this.logTest('Database Performance', isPerformant,
        `Basic operations completed in ${duration}ms`, { duration, threshold: 1000 });

    } catch (error) {
      this.logTest('Performance Test', false, error.message, error);
    }
  }

  // Print test results
  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('📊 TEST RESULTS SUMMARY');
    console.log('='.repeat(50));

    console.log(`Total Tests: ${this.totalTests}`);
    console.log(`✅ Passed: ${this.passedTests}`);
    console.log(`❌ Failed: ${this.failedTests}`);
    console.log(`📈 Success Rate: ${((this.passedTests / this.totalTests) * 100).toFixed(1)}%`);

    console.log('\n🔍 DETAILED RESULTS:');
    console.log('-'.repeat(50));

    this.testResults.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.testName}: ${result.message}`);
    });

    if (this.failedTests > 0) {
      console.log('\n⚠️  FAILED TESTS DETAILS:');
      console.log('-'.repeat(50));

      this.testResults
        .filter(result => !result.passed)
        .forEach((result, index) => {
          console.log(`${index + 1}. ${result.testName}:`);
          console.log(`   Error: ${result.message}`);
          if (result.details) {
            console.log(`   Details:`, result.details);
          }
          console.log('');
        });
    }

    // Overall status
    if (this.failedTests === 0) {
      console.log('🎉 ALL TESTS PASSED! Database system is working correctly.');
    } else if (this.passedTests > this.failedTests) {
      console.log('⚠️  MOST TESTS PASSED. Some issues need attention.');
    } else {
      console.log('🚨 MULTIPLE FAILURES. Database system needs significant fixes.');
    }

    console.log('='.repeat(50));

    return {
      totalTests: this.totalTests,
      passedTests: this.passedTests,
      failedTests: this.failedTests,
      successRate: (this.passedTests / this.totalTests) * 100,
      results: this.testResults
    };
  }

  // Export test results
  exportResults() {
    return {
      summary: {
        totalTests: this.totalTests,
        passedTests: this.passedTests,
        failedTests: this.failedTests,
        successRate: (this.passedTests / this.totalTests) * 100,
        timestamp: new Date().toISOString()
      },
      results: this.testResults
    };
  }
}

// Export for external use
export default DatabaseSystemTester;

// Self-test function for immediate execution
export async function runDatabaseSystemTest() {
  const tester = new DatabaseSystemTester();
  return await tester.runAllTests();
}

// Test runner for debugging
if (__DEV__) {
  console.log('🧪 Database System Tester loaded. Use runDatabaseSystemTest() to execute tests.');
}