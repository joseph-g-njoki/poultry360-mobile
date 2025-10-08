import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import ENV from '../config/environment';
import { apiCircuitBreaker } from '../utils/circuitBreaker';

// API Configuration loaded from environment variables
// To change the API URL, update the .env file (see .env.example for template)
const API_BASE_URL = ENV.apiUrl;

// CRITICAL DEBUG: Log the API URL being used
console.log('═══════════════════════════════════════════════════');
console.log('🌐 API SERVICE INITIALIZATION');
console.log('═══════════════════════════════════════════════════');
console.log('📍 API Base URL:', API_BASE_URL);
console.log('📱 Platform:', Platform.OS);
console.log('🔧 Environment Config:', ENV);
console.log('═══════════════════════════════════════════════════');

class ApiService {
  constructor() {
    this.retryCount = 3; // Number of retries for failed requests
    this.retryDelay = 1000; // Initial retry delay in ms
    this.requestsInFlight = new Map(); // Track in-flight requests to prevent duplicates

    console.log('🏗️  Creating Axios instance with base URL:', API_BASE_URL);

    this.api = axios.create({
      baseURL: API_BASE_URL,
      timeout: 30000, // CRASH FIX: Increased to 30 seconds for slow registration operations
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': Platform.OS === 'ios' ? 'Poultry360-iOS' : 'Poultry360-Android',
      },
    });

    console.log('✅ Axios instance created successfully');

    // Add request interceptor to include auth token and organization context
    this.api.interceptors.request.use(
      async (config) => {
        // CRASH FIX: Use 'authToken' to match AuthContext storage key (not 'userToken')
        const token = await AsyncStorage.getItem('authToken');
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }

        // Add organization context header if available
        const userData = await AsyncStorage.getItem('userData');
        if (userData) {
          try {
            const user = JSON.parse(userData);
            if (user.organizationId) {
              config.headers['X-Organization-Id'] = user.organizationId.toString();
            }
          } catch (error) {
            console.warn('Error parsing user data for organization context:', error);
          }
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Add response interceptor to handle common errors and retry logic
    this.api.interceptors.response.use(
      (response) => {
        return response;
      },
      async (error) => {
        const config = error.config;

        // Log network errors (simplified - just console)
        if (error.code === 'ECONNABORTED' || error.message?.includes('timeout')) {
          console.warn(`[API] Timeout: ${config?.url}`, error.message);
        } else if (error.response) {
          console.warn(`[API] Error ${error.response.status}: ${config?.url}`, error.message);
        } else if (error.request) {
          console.warn(`[API] No response: ${config?.url}`, error.message);
        }

        // Handle 401 errors (authentication issues)
        if (error.response?.status === 401) {
          // CRASH FIX: Use 'authToken' to match AuthContext storage key
          await AsyncStorage.removeItem('authToken');
          await AsyncStorage.removeItem('userData');
          return Promise.reject(error);
        }

        // Implement retry logic for network errors and 5xx errors
        if (!config || !config.retry) {
          config.retry = 0;
        }

        const shouldRetry = (
          config.retry < this.retryCount &&
          (
            !error.response || // Network error
            error.response.status >= 500 || // Server error
            error.code === 'ECONNABORTED' // Timeout
          )
        );

        if (shouldRetry) {
          config.retry += 1;

          // Exponential backoff
          const delay = this.retryDelay * Math.pow(2, config.retry - 1);

          await new Promise(resolve => setTimeout(resolve, delay));

          console.log(`Retrying request (${config.retry}/${this.retryCount}):`, config.url);

          return this.api(config);
        }

        return Promise.reject(error);
      }
    );
  }

  // Helper method to deduplicate simultaneous requests
  async makeRequestWithDedup(key, requestFn) {
    // Check if request is already in flight
    if (this.requestsInFlight.has(key)) {
      return this.requestsInFlight.get(key);
    }

    // Create new request
    const requestPromise = (async () => {
      try {
        const result = await requestFn();
        return result;
      } finally {
        // Clean up after request completes
        this.requestsInFlight.delete(key);
      }
    })();

    this.requestsInFlight.set(key, requestPromise);
    return requestPromise;
  }

  // Authentication endpoints
  async login(email, password, organizationSlug = null) {
    // FAST LOGIN: Skip circuit breaker for login - use direct request with custom timeout
    try {
      const loginData = {
        username: email,
        password,
      };

      // Add organization context if provided
      if (organizationSlug) {
        loginData.organizationSlug = organizationSlug;
      }

      console.log('🚀 API Service: Sending login request to backend...', {
        endpoint: `${API_BASE_URL}/auth/login`,
        username: email,
        hasPassword: !!password,
        hasOrganizationSlug: !!organizationSlug
      });

      // FAST LOGIN: Use shorter timeout for login (5 seconds max)
      const response = await this.api.post('/auth/login', loginData, {
        timeout: 5000,
        retry: 0 // No retries for login - fail fast
      });

      console.log('✅ API Service: Login response received', {
        status: response.status,
        hasData: !!response.data,
        hasAccessToken: !!response.data?.access_token,
        hasUser: !!response.data?.user
      });

      return response.data;
    } catch (error) {
      console.error('❌ API Service: Login request failed', {
        message: error.message,
        status: error.response?.status,
        statusText: error.response?.statusText,
        errorData: error.response?.data
      });
      throw this.handleError(error);
    }
  }

  async getUserOrganizations(username) {
    try {
      const response = await this.api.post('/auth/organizations', { username });
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async register(userData) {
    try {
      console.log('═══════════════════════════════════════════════════');
      console.log('📝 REGISTRATION REQUEST DETAILS');
      console.log('═══════════════════════════════════════════════════');
      console.log('📧 Email:', userData.email);
      console.log('👤 Username:', userData.username);
      console.log('🏢 Organization Type:', userData.organizationName ? 'create' : 'join');
      console.log('📍 Full API URL:', `${API_BASE_URL}/auth/register`);
      console.log('📦 Request Data:', JSON.stringify(userData, null, 2));
      console.log('═══════════════════════════════════════════════════');
      console.log('🚀 Sending request now...');

      // CRASH FIX: Add timeout override for registration (40 seconds for slow DB operations)
      const response = await this.api.post('/auth/register', userData, {
        timeout: 40000, // CRASH FIX: 40 seconds for registration (creating org + user + roles)
        retry: 2 // CRASH FIX: Allow 2 retries for registration
      });

      console.log('═══════════════════════════════════════════════════');
      console.log('✅ REGISTRATION SUCCESSFUL');
      console.log('═══════════════════════════════════════════════════');
      console.log('📥 Response Status:', response.status);
      console.log('📦 Response Data:', JSON.stringify(response.data, null, 2));
      console.log('═══════════════════════════════════════════════════');

      // CRASH FIX: Validate response data before returning
      if (!response.data) {
        throw new Error('Empty response from registration endpoint');
      }

      return response.data;
    } catch (error) {
      console.error('API Service: Registration failed', error.response?.data || error.message);
      throw this.handleError(error);
    }
  }

  async getProfile() {
    try {
      const response = await this.api.get('/auth/profile');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async verifyToken() {
    try {
      const response = await this.api.get('/auth/verify');
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Dashboard endpoints
  async getDashboard() {
    return this.makeRequestWithDedup('dashboard-overview', async () => {
      // Wrap dashboard requests in circuit breaker
      return apiCircuitBreaker.execute(async () => {
        try {
          // CRASH FIX: Use correct endpoint '/dashboard/overview' (not '/dashboard')
          const response = await this.api.get('/dashboard/overview');
          return response.data;
        } catch (error) {
          console.warn('[API] Dashboard load error:', error.message);
          // CRASH FIX: Return null instead of throwing to allow fallback to offline mode
          if (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED' || error.message?.includes('Network')) {
            console.warn('[API] Dashboard - Backend unreachable, app will use offline mode');
            return null;
          }
          throw this.handleError(error);
        }
      });
    });
  }

  // Farms endpoints
  async getFarms() {
    try {
      const response = await this.api.get('/farms');
      // Ensure we always return an array and map farmName to name for frontend compatibility
      const farms = Array.isArray(response.data?.farms) ? response.data.farms : [];
      return farms.map(farm => ({
        ...farm,
        name: farm.farmName || farm.name // Map farmName to name for dropdown compatibility
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createFarm(farmData) {
    try {
      const response = await this.api.post('/farms', farmData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateFarm(farmId, farmData) {
    try {
      const response = await this.api.put(`/farms/${farmId}`, farmData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteFarm(farmId) {
    try {
      const response = await this.api.delete(`/farms/${farmId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Flocks/Batches endpoints
  async getFlocks() {
    try {
      const response = await this.api.get('/flocks');
      // Ensure we always return an array and map batchName to name for frontend compatibility
      const batches = Array.isArray(response.data?.batches) ? response.data.batches : [];
      return batches.map(batch => ({
        ...batch,
        name: batch.batchName || batch.name || batch.batch_number // Map batchName to name for dropdown compatibility
      }));
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createFlock(flockData) {
    try {
      const response = await this.api.post('/flocks', flockData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateFlock(flockId, flockData) {
    try {
      const response = await this.api.put(`/flocks/${flockId}`, flockData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteFlock(flockId) {
    try {
      const response = await this.api.delete(`/flocks/${flockId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Feed Records endpoints
  async getFeedRecords() {
    try {
      const response = await this.api.get('/feed-records');
      // Ensure we always return an array
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createFeedRecord(recordData) {
    try {
      const response = await this.api.post('/feed-records', recordData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteFeedRecord(recordId) {
    try {
      const response = await this.api.delete(`/feed-records/${recordId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Health Records endpoints
  async getHealthRecords() {
    try {
      const response = await this.api.get('/health-records');
      // Ensure we always return an array
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createHealthRecord(recordData) {
    try {
      const response = await this.api.post('/health-records', recordData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateHealthRecord(recordId, recordData) {
    try {
      const response = await this.api.put(`/health-records/${recordId}`, recordData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteHealthRecord(recordId) {
    try {
      const response = await this.api.delete(`/health-records/${recordId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Mortality Records endpoints
  async getMortalityRecords() {
    try {
      const response = await this.api.get('/mortality-records');
      // Ensure we always return an array
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createMortalityRecord(recordData) {
    try {
      const response = await this.api.post('/mortality-records', recordData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteMortalityRecord(recordId) {
    try {
      const response = await this.api.delete(`/mortality-records/${recordId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Production Records endpoints
  async getProductionRecords() {
    try {
      const response = await this.api.get('/production-records');
      // Ensure we always return an array
      return Array.isArray(response.data) ? response.data : [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createProductionRecord(recordData) {
    try {
      const response = await this.api.post('/production-records', recordData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteProductionRecord(recordId) {
    try {
      const response = await this.api.delete(`/production-records/${recordId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Water Records endpoints
  async getWaterRecords(batchId = null) {
    try {
      const url = batchId ? `/water-records?batchId=${batchId}` : '/water-records';
      const response = await this.api.get(url);
      // Handle both { waterRecords: [] } and direct array response
      const records = response.data?.waterRecords || response.data;
      return Array.isArray(records) ? records : [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getWaterRecordsByBatch(batchId) {
    try {
      const response = await this.api.get(`/water-records/batch/${batchId}`);
      const records = response.data?.waterRecords || response.data;
      return Array.isArray(records) ? records : [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getWaterRecordSummary(batchId, startDate = null, endDate = null) {
    try {
      let url = `/water-records/summary/${batchId}`;
      const params = [];
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const response = await this.api.get(url);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createWaterRecord(recordData) {
    try {
      const response = await this.api.post('/water-records', recordData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateWaterRecord(recordId, recordData) {
    try {
      const response = await this.api.put(`/water-records/${recordId}`, recordData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteWaterRecord(recordId) {
    try {
      const response = await this.api.delete(`/water-records/${recordId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Weight Records Methods
  async getWeightRecords(batchId = null) {
    try {
      const url = batchId ? `/weight-records?batchId=${batchId}` : '/weight-records';
      const response = await this.api.get(url);
      // Handle both { weightRecords: [] } and direct array response
      const records = response.data?.weightRecords || response.data;
      return Array.isArray(records) ? records : [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getWeightRecordsByBatch(batchId) {
    try {
      const response = await this.api.get(`/weight-records/batch/${batchId}`);
      const records = response.data?.weightRecords || response.data;
      return Array.isArray(records) ? records : [];
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async getWeightTrends(batchId, startDate = null, endDate = null) {
    try {
      let url = `/weight-records/trends/${batchId}`;
      const params = [];
      if (startDate) params.push(`startDate=${startDate}`);
      if (endDate) params.push(`endDate=${endDate}`);
      if (params.length > 0) url += `?${params.join('&')}`;

      const response = await this.api.get(url);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async createWeightRecord(recordData) {
    try {
      const response = await this.api.post('/weight-records', recordData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async updateWeightRecord(recordId, recordData) {
    try {
      const response = await this.api.put(`/weight-records/${recordId}`, recordData);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  async deleteWeightRecord(recordId) {
    try {
      const response = await this.api.delete(`/weight-records/${recordId}`);
      return response.data;
    } catch (error) {
      throw this.handleError(error);
    }
  }

  // Error handler
  handleError(error) {
    try {
      console.log('═══════════════════════════════════════════════════');
      console.log('❌ ERROR HANDLER DETAILS');
      console.log('═══════════════════════════════════════════════════');
      console.log('🔍 Error Type:', error?.constructor?.name || typeof error);
      console.log('📦 Error Object:', error);
      console.log('📡 Has Response:', !!error?.response);
      console.log('🌐 Has Request:', !!error?.request);
      console.log('💬 Error Message:', error?.message);
      console.log('📍 Error Code:', error?.code);
      if (error?.response) {
        console.log('📥 Response Status:', error.response.status);
        console.log('📦 Response Data:', error.response.data);
      }
      console.log('═══════════════════════════════════════════════════');

      // CRASH FIX: Add null checks for error object
      if (!error) {
        return new Error('Unknown error occurred');
      }

      if (error.response) {
        // Server responded with error status
        const errorData = error.response.data;

        // Check for organization selection requirements
        if (errorData && errorData.requiresOrgSelection && errorData.organizations) {
          // CRASH FIX: Safe stringify to prevent circular reference errors
          try {
            const errorObj = new Error(JSON.stringify(errorData));
            errorObj.originalData = errorData;
            return errorObj;
          } catch (stringifyError) {
            // Circular reference detected - use safe extraction
            const safeErrorData = {
              requiresOrgSelection: errorData.requiresOrgSelection,
              organizations: errorData.organizations,
              message: errorData.message
            };
            const errorObj = new Error(JSON.stringify(safeErrorData));
            errorObj.originalData = errorData;
            return errorObj;
          }
        }

        // Handle validation errors (array of error messages)
        if (errorData && Array.isArray(errorData.message)) {
          // Join all validation error messages
          const validationErrors = errorData.message.join('\n\n');
          return new Error(validationErrors);
        }

        // Handle single error message
        const message = errorData?.message || errorData?.error || 'Server error occurred';
        return new Error(message);
      } else if (error.request) {
        // Network error
        return new Error('Network error. Please check your internet connection.');
      } else {
        // Something else - handle both Error objects and plain strings/objects
        if (typeof error === 'string') {
          return new Error(error);
        } else if (error && typeof error === 'object' && error.message) {
          return new Error(error.message);
        } else {
          return new Error('An unexpected error occurred');
        }
      }
    } catch (handlerError) {
      // CRASH FIX: If error handler itself fails, return a safe error
      console.error('Error handler failed:', handlerError);
      return new Error('Error handling failed - please try again');
    }
  }
}

export default new ApiService();