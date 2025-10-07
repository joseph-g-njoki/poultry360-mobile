import AsyncStorage from '@react-native-async-storage/async-storage';
import fastDatabase from './fastDatabase';

class FastApiService {
  constructor() {
    this.isReady = false;
  }

  // INSTANT initialization - no complex logic
  init() {
    try {
      this.isReady = true;
      fastDatabase.init(); // This is instant
      return Promise.resolve(true);
    } catch (error) {
      this.isReady = true; // Always continue
      return Promise.resolve(true);
    }
  }

  // Authentication - simplified and fast
  async login(email, password) {
    try {
      // Demo credentials check
      const demoCredentials = [
        { email: 'demo@poultry360.com', password: 'demo123' },
        { email: 'owner@poultry360.com', password: 'owner123' },
        { email: 'admin@poultry360.com', password: 'admin123' }
      ];

      const isDemo = demoCredentials.some(cred =>
        cred.email === email && cred.password === password
      );

      if (isDemo) {
        const user = fastDatabase.getUserByEmail(email);
        if (user) {
          // Store user data
          await AsyncStorage.setItem('userData', JSON.stringify(user));
          await AsyncStorage.setItem('authToken', 'demo_token');

          return {
            success: true,
            data: {
              user: {
                id: user.id,
                email: user.email,
                firstName: user.first_name,
                lastName: user.last_name,
                role: user.role,
                organizationId: user.organization_id || 1,
                organizationName: user.organization_name || 'Demo Organization',
                organizationSlug: user.organization_slug || 'demo-org'
              },
              token: 'demo_token'
            },
            source: 'local'
          };
        }
      }

      // For non-demo users, just return success (offline mode)
      const user = fastDatabase.getUserByEmail(email);
      if (user) {
        await AsyncStorage.setItem('userData', JSON.stringify(user));
        await AsyncStorage.setItem('authToken', 'offline_token');

        return {
          success: true,
          data: {
            user: {
              id: user.id,
              email: user.email,
              firstName: user.first_name,
              lastName: user.last_name,
              role: user.role,
              organizationId: user.organization_id || 1,
              organizationName: user.organization_name || 'Demo Organization',
              organizationSlug: user.organization_slug || 'demo-org'
            },
            token: 'offline_token'
          },
          source: 'local'
        };
      }

      return {
        success: false,
        error: 'Invalid credentials'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Login failed'
      };
    }
  }

  async register(userData) {
    try {
      // Simple registration - return success with user's selected role
      return {
        success: true,
        data: {
          user: {
            id: Date.now(), // Generate a unique ID
            email: userData.email,
            firstName: userData.firstName,
            lastName: userData.lastName,
            username: userData.username,
            phone: userData.phone,
            role: userData.role || 'worker', // Use selected role or default to worker
            organizationId: userData.organizationId || 1,
            organizationName: userData.organizationName || 'Demo Organization',
            organizationSlug: 'demo-org'
          },
          token: 'offline_token'
        },
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: 'Registration failed'
      };
    }
  }

  async getProfile() {
    try {
      const userData = await AsyncStorage.getItem('userData');
      if (userData) {
        const user = JSON.parse(userData);
        return {
          success: true,
          data: {
            id: user.id,
            email: user.email,
            firstName: user.first_name,
            lastName: user.last_name,
            role: user.role
          },
          source: 'local'
        };
      }
      return { success: false, error: 'No user data found' };
    } catch (error) {
      return { success: false, error: 'Failed to get profile' };
    }
  }

  async updateProfile(profileData) {
    try {
      // Get current user data
      const userData = await AsyncStorage.getItem('userData');
      if (!userData) {
        return { success: false, error: 'No user data found' };
      }

      const user = JSON.parse(userData);

      // Update user data
      const updatedUser = {
        ...user,
        first_name: profileData.firstName || user.first_name,
        last_name: profileData.lastName || user.last_name,
        phone: profileData.phone || user.phone
      };

      // Save to AsyncStorage
      await AsyncStorage.setItem('userData', JSON.stringify(updatedUser));

      return {
        success: true,
        data: {
          id: updatedUser.id,
          email: updatedUser.email,
          firstName: updatedUser.first_name,
          lastName: updatedUser.last_name,
          role: updatedUser.role,
          phone: updatedUser.phone,
          createdAt: updatedUser.created_at,
          organizationId: updatedUser.organization_id
        },
        source: 'local'
      };
    } catch (error) {
      return { success: false, error: 'Failed to update profile' };
    }
  }

  async getDashboard() {
    try {
      console.log('🔄 FastApiService.getDashboard() called');
      const data = fastDatabase.getDashboardData();
      console.log('🔄 Dashboard data retrieved from fastDatabase');
      return {
        success: true,
        data,
        source: 'local'
      };
    } catch (error) {
      console.log('🔄 Dashboard data error in fastApiService:', error.message);
      return {
        success: true,
        data: {
          farms: 0,
          activeBatches: 0,
          totalBirds: 0,
          recentMortality: 0,
          todayProduction: 0,
          totalFarms: 0,
          totalFlocks: 0,
          eggsToday: 0,
          deathsToday: 0,
          myRecordsToday: 0,
          recentActivities: [],
          alerts: []
        },
        source: 'fallback'
      };
    }
  }

  async getFarms() {
    try {
      const farms = fastDatabase.getFarms();
      return {
        success: true,
        data: Array.isArray(farms) ? farms.map(farm => ({
          id: farm?.id || Date.now(),
          farmName: farm?.farm_name || 'Unknown Farm',
          name: farm?.farm_name || 'Unknown Farm',
          location: farm?.location || 'Unknown Location',
          farmType: farm?.farm_type || 'broiler',
          description: farm?.description || '',
          createdAt: farm?.created_at || new Date().toISOString()
        })) : [],
        source: 'local'
      };
    } catch (error) {
      console.warn('getFarms error:', error);
      return {
        success: true,
        data: [],
        source: 'fallback'
      };
    }
  }

  async getFlocks() {
    try {
      const batches = fastDatabase.getBatches();
      return {
        success: true,
        data: Array.isArray(batches) ? batches.map(batch => ({
          id: batch?.id || Date.now(),
          batchName: batch?.batch_name || 'Unknown Batch',
          name: batch?.batch_name || 'Unknown Batch',
          breed: batch?.breed || 'Unknown Breed',
          birdType: batch?.breed || 'Unknown Breed',
          initialCount: batch?.initial_count || 0,
          currentCount: batch?.current_count || 0,
          farmId: batch?.farm_id || 1,
          arrivalDate: batch?.arrival_date || batch?.created_at || new Date().toISOString(),
          startDate: batch?.arrival_date || batch?.created_at || new Date().toISOString(),
          status: batch?.status || 'active',
          createdAt: batch?.created_at || new Date().toISOString()
        })) : [],
        source: 'local'
      };
    } catch (error) {
      console.warn('getFlocks error:', error);
      return {
        success: true,
        data: [],
        source: 'fallback'
      };
    }
  }

  // REAL CRUD OPERATIONS FOR RECORDS
  async createRecord(recordType, recordData) {
    try {
      const result = fastDatabase.createRecord(recordType, recordData);
      return {
        success: true,
        data: result,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getRecords(recordType) {
    try {
      const records = fastDatabase.getAllRecords(recordType);
      return {
        success: true,
        data: records || [],
        source: 'local'
      };
    } catch (error) {
      return {
        success: true,
        data: [],
        source: 'fallback'
      };
    }
  }

  async deleteRecord(recordType, recordId) {
    try {
      fastDatabase.deleteRecord(recordType, recordId);
      return {
        success: true,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // REAL FARM OPERATIONS
  async createFarm(farmData) {
    try {
      const result = fastDatabase.createFarm(farmData);
      return {
        success: true,
        data: result,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateFarm(farmId, farmData) {
    try {
      const result = fastDatabase.updateFarm(farmId, farmData);
      return {
        success: true,
        data: result,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteFarm(farmId) {
    try {
      fastDatabase.deleteFarm(farmId);
      return {
        success: true,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // REAL FLOCK/BATCH OPERATIONS
  async createFlock(flockData) {
    try {
      const result = fastDatabase.createBatch(flockData);
      return {
        success: true,
        data: result,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async updateFlock(flockId, flockData) {
    try {
      const result = fastDatabase.updateBatch(flockId, flockData);
      return {
        success: true,
        data: result,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async deleteFlock(flockId) {
    try {
      fastDatabase.deleteBatch(flockId);
      return {
        success: true,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // WATER RECORDS
  async createWaterRecord(recordData) {
    try {
      const result = fastDatabase.createWaterRecord(recordData);
      return {
        success: true,
        data: result,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getWaterRecords(batchId = null) {
    try {
      const records = fastDatabase.getWaterRecords();
      // Filter by batchId if provided
      const filteredRecords = batchId ? records.filter(r => r.batch_id === batchId) : records;
      return {
        success: true,
        data: filteredRecords,
        waterRecords: filteredRecords,
        source: 'local'
      };
    } catch (error) {
      return {
        success: true,
        data: [],
        waterRecords: [],
        source: 'fallback'
      };
    }
  }

  async deleteWaterRecord(recordId) {
    try {
      fastDatabase.deleteWaterRecord(recordId);
      return {
        success: true,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // WEIGHT RECORDS
  async createWeightRecord(recordData) {
    try {
      const result = fastDatabase.createWeightRecord(recordData);
      return {
        success: true,
        data: result,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  async getWeightRecords(batchId = null) {
    try {
      const records = fastDatabase.getWeightRecords();
      // Filter by batchId if provided
      const filteredRecords = batchId ? records.filter(r => r.batch_id === batchId) : records;
      return {
        success: true,
        data: filteredRecords,
        weightRecords: filteredRecords,
        source: 'local'
      };
    } catch (error) {
      return {
        success: true,
        data: [],
        weightRecords: [],
        source: 'fallback'
      };
    }
  }

  async deleteWeightRecord(recordId) {
    try {
      fastDatabase.deleteWeightRecord(recordId);
      return {
        success: true,
        source: 'local'
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  }

  // Utility methods
  isOnlineMode() {
    return false; // Always offline for simplicity
  }

  isOfflineMode() {
    return true; // Always offline for simplicity
  }

  getConnectionState() {
    return {
      isOnline: false,
      isOffline: true,
      networkState: { isConnected: false }
    };
  }

  async getStorageStats() {
    return {
      farms: 1,
      batches: 1,
      feedRecords: 0,
      productionRecords: 0,
      mortalityRecords: 0,
      healthRecords: 0,
      pendingSync: 0,
      failedSync: 0,
      total: 2
    };
  }
}

// Export singleton instance
const fastApiService = new FastApiService();
export default fastApiService;