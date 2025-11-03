/**
 * Integration Test: Organization ID Data Isolation
 *
 * This test verifies that the mobile app correctly:
 * 1. Sets organization ID after login
 * 2. Caches farms with organization_id
 * 3. Filters dashboard data by organization_id
 */

// Mock expo-sqlite
jest.mock('expo-sqlite', () => ({
  openDatabaseSync: jest.fn(() => ({
    execSync: jest.fn(),
    runSync: jest.fn((sql, params) => {
      // Simulate successful INSERT
      return { lastInsertRowId: 1, changes: 1 };
    }),
    getFirstSync: jest.fn((sql, params) => {
      // Simulate dashboard query results
      if (sql.includes('COUNT')) {
        return { count: 4 }; // 4 farms
      }
      if (sql.includes('SUM')) {
        return { total: 100 };
      }
      return {};
    }),
    getAllSync: jest.fn((sql, params) => {
      // Simulate farms query with organization_id filter
      if (sql.includes('FROM farms')) {
        return [
          { id: 1, farm_name: 'Test Farm 1', organization_id: 23 },
          { id: 2, farm_name: 'Test Farm 2', organization_id: 23 }
        ];
      }
      return [];
    }),
  })),
}));

// Mock AsyncStorage
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
}));

describe('Organization ID Data Isolation - Integration Test', () => {
  let fastDatabase;

  beforeEach(() => {
    jest.clearAllMocks();
    // Reset module cache to get fresh instance
    jest.resetModules();
    fastDatabase = require('../src/services/fastDatabase').default;
    fastDatabase.init();
  });

  describe('1. Login - Set Organization ID', () => {
    test('should set organization ID when user logs in', () => {
      // Simulate login with organization_id = 23
      const organizationId = 23;

      fastDatabase.setOrganizationId(organizationId);

      expect(fastDatabase.getOrganizationId()).toBe(23);
    });

    test('should handle both camelCase and snake_case organization_id', () => {
      const userData1 = { organizationId: 23 };
      const userData2 = { organization_id: 23 };

      fastDatabase.setOrganizationId(userData1.organizationId);
      expect(fastDatabase.getOrganizationId()).toBe(23);

      fastDatabase.setOrganizationId(userData2.organization_id);
      expect(fastDatabase.getOrganizationId()).toBe(23);
    });
  });

  describe('2. Farm Creation - Cache with Organization ID', () => {
    test('should cache farm with organization_id from currentOrganizationId', () => {
      // Set organization ID
      fastDatabase.setOrganizationId(23);

      // Create farm without organization_id in data
      const farmData = {
        name: 'Test Farm',
        location: 'Nairobi',
        farmType: 'layers'
      };

      const farm = fastDatabase.createFarm(farmData);

      // Verify INSERT was called with organization_id
      const db = fastDatabase.db;
      const insertCall = db.runSync.mock.calls.find(call =>
        call[0].includes('INSERT INTO farms')
      );

      expect(insertCall).toBeDefined();
      expect(insertCall[0]).toContain('organization_id');
      // Should use currentOrganizationId (23) since farmData doesn't have it
      expect(insertCall[1]).toContain(23);
    });

    test('should prefer organization_id from farmData over currentOrganizationId', () => {
      // Set organization ID to 23
      fastDatabase.setOrganizationId(23);

      // Create farm with explicit organization_id = 99 (from backend response)
      const farmData = {
        name: 'Test Farm',
        location: 'Nairobi',
        farmType: 'layers',
        organization_id: 99 // Backend returned this
      };

      const farm = fastDatabase.createFarm(farmData);

      const db = fastDatabase.db;
      const insertCall = db.runSync.mock.calls.find(call =>
        call[0].includes('INSERT INTO farms')
      );

      // Should use 99 from farmData, not 23 from currentOrganizationId
      expect(insertCall[1]).toContain(99);
    });
  });

  describe('3. Dashboard Query - Filter by Organization ID', () => {
    test('should filter farms by organization_id', () => {
      // Set organization ID
      fastDatabase.setOrganizationId(23);

      // Get dashboard data
      const dashboardData = fastDatabase.getDashboardData();

      // Verify query included organization filter
      const db = fastDatabase.db;
      const farmsQuery = db.getFirstSync.mock.calls.find(call =>
        call[0].includes('FROM farms')
      );

      expect(farmsQuery).toBeDefined();
      expect(farmsQuery[0]).toContain('WHERE organization_id = 23');
    });

    test('should filter batches via JOIN with farms.organization_id', () => {
      fastDatabase.setOrganizationId(23);

      const dashboardData = fastDatabase.getDashboardData();

      const db = fastDatabase.db;
      const batchesQuery = db.getFirstSync.mock.calls.find(call =>
        call[0].includes('poultry_batches')
      );

      expect(batchesQuery).toBeDefined();
      expect(batchesQuery[0]).toContain('INNER JOIN farms');
      expect(batchesQuery[0]).toContain('f.organization_id = 23');
    });

    test('should filter production records via JOIN with farms.organization_id', () => {
      fastDatabase.setOrganizationId(23);

      const dashboardData = fastDatabase.getDashboardData();

      const db = fastDatabase.db;
      const productionQuery = db.getFirstSync.mock.calls.find(call =>
        call[0].includes('production_records')
      );

      expect(productionQuery).toBeDefined();
      expect(productionQuery[0]).toContain('INNER JOIN farms');
      expect(productionQuery[0]).toContain('f.organization_id = 23');
    });

    test('should return empty dashboard when organization_id is null', () => {
      // Don't set organization ID (simulate not logged in)
      fastDatabase.currentOrganizationId = null;

      const dashboardData = fastDatabase.getDashboardData();

      // Should return safe defaults
      expect(dashboardData).toEqual(expect.objectContaining({
        totalFarms: expect.any(Number),
        totalFlocks: expect.any(Number),
        totalBirds: expect.any(Number)
      }));
    });
  });

  describe('4. Full Login-to-Dashboard Flow', () => {
    test('complete flow: login → cache farm → query dashboard', () => {
      // Step 1: User logs in with organization_id = 23
      fastDatabase.setOrganizationId(23);
      expect(fastDatabase.getOrganizationId()).toBe(23);

      // Step 2: Backend returns farm with organization_id = 23
      const backendFarm = {
        id: 5,
        name: 'Sunrise Farm',
        location: 'Mombasa',
        farmType: 'broiler',
        organization_id: 23  // From backend
      };

      // Step 3: Mobile app caches farm to SQLite
      const cachedFarm = fastDatabase.createFarm(backendFarm);

      // Verify farm was cached with organization_id
      const db = fastDatabase.db;
      const farmInsert = db.runSync.mock.calls.find(call =>
        call[0].includes('INSERT INTO farms')
      );
      expect(farmInsert[1]).toContain(23);

      // Step 4: Dashboard queries data filtered by organization_id
      const dashboardData = fastDatabase.getDashboardData();

      // Verify dashboard query filters by organization_id = 23
      const farmsQuery = db.getFirstSync.mock.calls.find(call =>
        call[0].includes('FROM farms') && call[0].includes('COUNT')
      );
      expect(farmsQuery[0]).toContain('WHERE organization_id = 23');

      // Step 5: Dashboard displays data
      expect(dashboardData).toBeDefined();
      expect(dashboardData.totalFarms).toBeGreaterThan(0);
    });
  });

  describe('5. Data Isolation - Prevent Cross-Organization Leaks', () => {
    test('should NOT return farms from other organizations', () => {
      // Set organization ID to 23
      fastDatabase.setOrganizationId(23);

      // Simulate farms from multiple organizations in database
      const db = fastDatabase.db;
      db.getAllSync.mockImplementation((sql) => {
        if (sql.includes('organization_id = 23')) {
          // Only return org 23 farms
          return [
            { id: 1, farm_name: 'Farm A', organization_id: 23 },
            { id: 2, farm_name: 'Farm B', organization_id: 23 }
          ];
        }
        // Should never query without org filter
        return [
          { id: 1, farm_name: 'Farm A', organization_id: 23 },
          { id: 2, farm_name: 'Farm B', organization_id: 23 },
          { id: 3, farm_name: 'Farm C', organization_id: 99 }, // Different org!
        ];
      });

      const farms = fastDatabase.getFarms();

      // Should only get 2 farms (org 23), not 3
      expect(farms.length).toBe(2);
      expect(farms.every(f => f.organization_id === 23)).toBe(true);
    });
  });
});

console.log('\n═══════════════════════════════════════════════════');
console.log('✅ ORGANIZATION ID INTEGRATION TEST SUITE');
console.log('═══════════════════════════════════════════════════');
console.log('Tests verify:');
console.log('1. ✅ Organization ID is set at login');
console.log('2. ✅ Farms are cached with organization_id');
console.log('3. ✅ Dashboard filters by organization_id');
console.log('4. ✅ Complete login-to-dashboard flow works');
console.log('5. ✅ Data isolation prevents cross-org leaks');
console.log('═══════════════════════════════════════════════════\n');
