/**
 * Manual Integration Test Runner
 *
 * This script tests the mobile app integration with the backend
 * using pure Node.js without React Native dependencies.
 */

const axios = require('axios');
const crypto = require('crypto');

// Configuration
const API_BASE_URL = 'http://localhost:3000/api';
const TIMEOUT = 30000;

// Test results tracking
const results = {
  total: 0,
  passed: 0,
  failed: 0,
  tests: [],
};

// Helper function to create unique test data
function generateUniqueId() {
  return crypto.randomBytes(4).toString('hex');
}

// Helper function to run a test
async function runTest(name, testFn) {
  results.total++;
  try {
    console.log(`\n[ RUN  ] ${name}`);
    await testFn();
    results.passed++;
    results.tests.push({ name, status: 'PASS', error: null });
    console.log(`[  OK  ] ${name}`);
  } catch (error) {
    results.failed++;
    results.tests.push({ name, status: 'FAIL', error: error.message });
    console.log(`[ FAIL ] ${name}`);
    console.error(`  Error: ${error.message}`);
  }
}

// Test context to share data between tests
const testContext = {
  authToken: null,
  user: null,
  farm: null,
  batch: null,
};

// Main test suite
async function runIntegrationTests() {
  console.log('========================================');
  console.log('POULTRY360 INTEGRATION TEST SUITE');
  console.log('========================================');
  console.log(`API URL: ${API_BASE_URL}`);
  console.log(`Date: ${new Date().toISOString()}\n`);

  try {
    // ===== PHASE 1: CONNECTION & AUTHENTICATION =====
    console.log('\n===== PHASE 1: CONNECTION & AUTHENTICATION =====\n');

    await runTest('Backend API should be accessible', async () => {
      const response = await axios.get(`${API_BASE_URL}/health`, { timeout: TIMEOUT });
      if (response.status !== 200) throw new Error(`Expected 200, got ${response.status}`);
    });

    await runTest('Should register a new user', async () => {
      const uniqueId = generateUniqueId();
      const registrationData = {
        email: `integtest.${uniqueId}@poultry360.test`,
        username: `integtest_${uniqueId}`,
        password: 'IntegTest@2025!',
        firstName: 'Integration',
        lastName: 'Test',
        phoneNumber: `+25670${uniqueId.substring(0, 7)}`,
        organizationName: `IntegTest Org ${Date.now()}`,
      };

      try {
        const response = await axios.post(`${API_BASE_URL}/auth/register`, registrationData, { timeout: TIMEOUT });

        if (!response.data.access_token) throw new Error('No access token received');
        if (!response.data.user) throw new Error('No user data received');

        testContext.authToken = response.data.access_token;
        testContext.user = response.data.user;
      } catch (error) {
        if (error.response) {
          throw new Error(`Registration failed: ${JSON.stringify(error.response.data)}`);
        }
        throw error;
      }
    });

    await runTest('Should login with valid credentials', async () => {
      const loginData = {
        username: testContext.user.email,
        password: 'IntegTest@2025!',
      };

      const response = await axios.post(`${API_BASE_URL}/auth/login`, loginData, { timeout: TIMEOUT });

      if (!response.data.access_token) throw new Error('No access token received');
      testContext.authToken = response.data.access_token;
    });

    await runTest('Should reject login with invalid password', async () => {
      try {
        await axios.post(`${API_BASE_URL}/auth/login`, {
          username: testContext.user.email,
          password: 'WrongPassword123',
        }, { timeout: TIMEOUT });
        throw new Error('Should have rejected invalid password');
      } catch (error) {
        if (error.response && error.response.status === 401) {
          // Expected error
        } else if (error.message === 'Should have rejected invalid password') {
          throw error;
        }
      }
    });

    await runTest('Should get user profile with valid token', async () => {
      const response = await axios.get(`${API_BASE_URL}/auth/profile`, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });

      if (!response.data) throw new Error('No profile data received');
      if (response.data.email !== testContext.user.email) {
        throw new Error('Profile email mismatch');
      }
    });

    // ===== PHASE 2: CORE FEATURES =====
    console.log('\n===== PHASE 2: CORE FEATURES =====\n');

    await runTest('Should load dashboard data', async () => {
      const response = await axios.get(`${API_BASE_URL}/dashboard/overview`, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });

      if (!response.data) throw new Error('No dashboard data received');
      if (typeof response.data.totalFarms !== 'number') {
        throw new Error('Dashboard missing totalFarms metric');
      }
    });

    await runTest('Should create a new farm', async () => {
      const farmData = {
        farmName: `Integration Test Farm ${Date.now()}`,
        location: 'Kampala, Uganda',
        capacity: 5000,
        farmType: 'layers',
      };

      const response = await axios.post(`${API_BASE_URL}/farms`, farmData, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });

      if (!response.data.id) throw new Error('No farm ID received');
      testContext.farm = response.data;
    });

    await runTest('Should retrieve farms list', async () => {
      const response = await axios.get(`${API_BASE_URL}/farms`, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });

      const farms = response.data.farms || response.data;
      if (!Array.isArray(farms)) throw new Error('Farms list is not an array');
      if (farms.length === 0) throw new Error('Farms list is empty');

      const ourFarm = farms.find(f => f.id === testContext.farm.id);
      if (!ourFarm) throw new Error('Created farm not found in list');
    });

    await runTest('Should update farm details', async () => {
      const updatedData = {
        farmName: `Updated Farm ${Date.now()}`,
        capacity: 6000,
      };

      const response = await axios.put(`${API_BASE_URL}/farms/${testContext.farm.id}`, updatedData, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });

      if (!response.data) throw new Error('No response data');
      testContext.farm = response.data;
    });

    await runTest('Should create a new batch', async () => {
      const batchData = {
        batchName: `Test Batch ${Date.now()}`,
        farmId: testContext.farm.id,
        batchNumber: `B${Date.now()}`,
        birdType: 'Layers',
        initialCount: 1000,
        startDate: new Date().toISOString().split('T')[0],
        status: 'active',
      };

      const response = await axios.post(`${API_BASE_URL}/flocks`, batchData, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });

      if (!response.data.id) throw new Error('No batch ID received');
      testContext.batch = response.data;
    });

    await runTest('Should create a production record', async () => {
      const recordData = {
        batchId: testContext.batch.id,
        date: new Date().toISOString().split('T')[0],
        eggsCollected: 850,
        goodEggs: 820,
        brokenEggs: 20,
        deformedEggs: 10,
      };

      const response = await axios.post(`${API_BASE_URL}/production-records`, recordData, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });

      if (!response.data.id) throw new Error('No production record ID received');
      testContext.productionRecord = response.data;
    });

    await runTest('Should create a mortality record', async () => {
      const recordData = {
        batchId: testContext.batch.id,
        date: new Date().toISOString().split('T')[0],
        mortalityCount: 10,
        cause: 'Disease',
        notes: 'Integration test mortality',
      };

      const response = await axios.post(`${API_BASE_URL}/mortality-records`, recordData, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });

      if (!response.data.id) throw new Error('No mortality record ID received');
      testContext.mortalityRecord = response.data;
    });

    await runTest('Should create a feed record', async () => {
      const recordData = {
        batchId: testContext.batch.id,
        date: new Date().toISOString().split('T')[0],
        feedType: 'Layers Mash',
        quantity: 150,
        cost: 75000,
      };

      const response = await axios.post(`${API_BASE_URL}/feed-records`, recordData, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });

      if (!response.data.id) throw new Error('No feed record ID received');
      testContext.feedRecord = response.data;
    });

    // ===== PHASE 3: DATA INTEGRITY =====
    console.log('\n===== PHASE 3: DATA INTEGRITY =====\n');

    await runTest('Should verify production record persists in backend', async () => {
      const response = await axios.get(`${API_BASE_URL}/production-records`, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });

      const records = response.data;
      if (!Array.isArray(records)) throw new Error('Production records is not an array');

      const ourRecord = records.find(r => r.id === testContext.productionRecord.id);
      if (!ourRecord) throw new Error('Production record not found');
    });

    await runTest('Should verify dashboard reflects new data', async () => {
      const response = await axios.get(`${API_BASE_URL}/dashboard/overview`, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });

      if (response.data.totalFarms < 1) throw new Error('Dashboard totalFarms not updated');
      if (response.data.totalBatches < 1) throw new Error('Dashboard totalBatches not updated');
    });

    // ===== CLEANUP =====
    console.log('\n===== CLEANUP =====\n');

    await runTest('Should delete production record', async () => {
      await axios.delete(`${API_BASE_URL}/production-records/${testContext.productionRecord.id}`, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });
    });

    await runTest('Should delete mortality record', async () => {
      await axios.delete(`${API_BASE_URL}/mortality-records/${testContext.mortalityRecord.id}`, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });
    });

    await runTest('Should delete feed record', async () => {
      await axios.delete(`${API_BASE_URL}/feed-records/${testContext.feedRecord.id}`, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });
    });

    await runTest('Should delete batch', async () => {
      await axios.delete(`${API_BASE_URL}/flocks/${testContext.batch.id}`, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });
    });

    await runTest('Should delete farm', async () => {
      await axios.delete(`${API_BASE_URL}/farms/${testContext.farm.id}`, {
        headers: {
          'Authorization': `Bearer ${testContext.authToken}`,
          'X-Organization-Id': testContext.user.organizationId,
        },
        timeout: TIMEOUT,
      });
    });

  } catch (error) {
    console.error('\n❌ Test suite error:', error.message);
  }

  // Print summary
  console.log('\n========================================');
  console.log('TEST SUMMARY');
  console.log('========================================');
  console.log(`Total Tests: ${results.total}`);
  console.log(`Passed: ${results.passed} ✓`);
  console.log(`Failed: ${results.failed} ✗`);
  console.log(`Pass Rate: ${((results.passed / results.total) * 100).toFixed(1)}%`);

  // Calculate production readiness score
  const passRate = (results.passed / results.total) * 100;
  const productionReadinessScore = Math.round(passRate);

  console.log(`\nProduction Readiness Score: ${productionReadinessScore}/100`);

  if (productionReadinessScore >= 95) {
    console.log('Status: ✅ PRODUCTION READY');
  } else if (productionReadinessScore >= 80) {
    console.log('Status: ⚠️ READY WITH MINOR ISSUES');
  } else {
    console.log('Status: ❌ NOT PRODUCTION READY');
  }

  // List failed tests
  if (results.failed > 0) {
    console.log('\n========================================');
    console.log('FAILED TESTS');
    console.log('========================================');
    results.tests.filter(t => t.status === 'FAIL').forEach(test => {
      console.log(`\n✗ ${test.name}`);
      console.log(`  ${test.error}`);
    });
  }

  console.log('\n');

  // Exit with appropriate code
  process.exit(results.failed > 0 ? 1 : 0);
}

// Run the tests
runIntegrationTests().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
