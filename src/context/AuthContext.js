import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import fastApiService from '../services/fastApiService';
import apiService from '../services/api';
import asyncOperationWrapper from '../utils/asyncOperationWrapper';
import notificationService from '../services/notificationService';
import syncService from '../services/syncService';
import authStorage from '../services/authStorage';
import networkService from '../services/networkService';

const AuthContext = createContext();

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authError, setAuthError] = useState(null);

  // Check if user is already logged in on app start
  useEffect(() => {
    const isMountedRef = { current: true };
    let authCheckTimer = null;

    // PERFORMANCE FIX: Auth check should be INSTANT from storage, network check in background
    const performQuickAuthCheck = async () => {
      if (!isMountedRef.current) return;

      try {
        setIsLoading(true);

        // INSTANT: Check local storage only (no network calls)
        const token = await asyncOperationWrapper.safeStorageGet('authToken');
        const userData = await asyncOperationWrapper.safeStorageGet('userData');

        if (token && userData) {
          try {
            const storedUser = JSON.parse(userData);

            // ENHANCED LOGGING: Debug stored user data
            console.log('═══════════════════════════════════════════════════');
            console.log('🔍 AUTH RESTORATION - STORED USER DATA');
            console.log('═══════════════════════════════════════════════════');
            console.log('Email:', storedUser?.email);
            console.log('Role:', storedUser?.role);
            console.log('Organization ID:', storedUser?.organizationId);
            console.log('Organization (alt):', storedUser?.organization_id);
            console.log('User ID:', storedUser?.id);
            console.log('Full user keys:', Object.keys(storedUser || {}));
            console.log('═══════════════════════════════════════════════════');

            if (storedUser && typeof storedUser === 'object' && storedUser.email) {
              // INSTANT AUTH SUCCESS - show UI immediately
              if (isMountedRef.current) {
                setUser(storedUser);
                setIsAuthenticated(true);

                // 🔐 CRITICAL FIX: Set organization ID for data isolation
                // Support both camelCase and snake_case
                const orgId = storedUser.organizationId || storedUser.organization_id;
                if (orgId) {
                  const fastDatabase = require('../services/fastDatabase').default;
                  fastDatabase.setOrganizationId(orgId);
                  console.log('═══════════════════════════════════════════════════');
                  console.log('🏢 ORGANIZATION ID RESTORED FROM STORAGE');
                  console.log('═══════════════════════════════════════════════════');
                  console.log('Organization ID:', orgId);
                  console.log('User:', storedUser.email);
                  console.log('═══════════════════════════════════════════════════');
                } else {
                  console.error('═══════════════════════════════════════════════════');
                  console.error('🚨 CRITICAL ERROR: USER HAS NO ORGANIZATION ID!');
                  console.error('═══════════════════════════════════════════════════');
                  console.error('This will cause data leaks across organizations!');
                  console.error('User email:', storedUser.email);
                  console.error('User data:', JSON.stringify(storedUser, null, 2));
                  console.error('═══════════════════════════════════════════════════');
                }

                console.log('⚡ Instant auth check successful (from storage)');
              }

              // BACKGROUND: Verify with server (don't block UI)
              setImmediate(() => {
                if (!isMountedRef.current) return;
                fastApiService.getProfile()
                  .then(response => {
                    if (response.success && response.data && isMountedRef.current) {
                      setUser(response.data);

                      // 🔐 CRITICAL: Update organization ID if server returns updated user data
                      const serverOrgId = response.data.organizationId || response.data.organization_id;
                      if (serverOrgId) {
                        const fastDatabase = require('../services/fastDatabase').default;
                        fastDatabase.setOrganizationId(serverOrgId);
                        console.log('🏢 Organization ID updated from server:', serverOrgId);
                      }

                      console.log('✅ Background: Auth verified with server');
                    }
                  })
                  .catch(err => {
                    console.log('ℹ️  Background: Server auth check skipped (offline mode)');
                  });
              });
            } else {
              console.warn('Invalid stored user data');
              if (isMountedRef.current) await clearAuthData();
            }
          } catch (parseError) {
            console.warn('Failed to parse stored user data:', parseError.message);
            if (isMountedRef.current) await clearAuthData();
          }
        } else {
          console.log('No stored auth data found');
        }
      } catch (error) {
        console.error('Auth check error:', error);
        if (isMountedRef.current) {
          setAuthError(error.message);
          await clearAuthData();
        }
      } finally {
        if (isMountedRef.current) {
          setIsLoading(false);
        }
      }
    };

    // INSTANT: No delay - check immediately
    performQuickAuthCheck();

    return () => {
      isMountedRef.current = false;
      if (authCheckTimer) {
        clearTimeout(authCheckTimer);
        authCheckTimer = null;
      }
    };
  }, [clearAuthData]);

  const clearAuthData = useCallback(async () => {
    try {
      await asyncOperationWrapper.safeStorageRemove('authToken');
      await asyncOperationWrapper.safeStorageRemove('userData');
      setUser(null);
      setIsAuthenticated(false);
      setAuthError(null);
      console.log('Auth data cleared');
    } catch (error) {
      console.error('Error clearing auth data:', error);
    }
  }, []);

  const checkAuthStatus = useCallback(async (abortController = null, isMounted = { current: true }) => {
    try {
      // CRASH FIX: Check if component is still mounted before setState
      if (!isMounted.current) {
        console.log('Auth check skipped - component unmounted');
        return;
      }

      setIsLoading(true);
      setAuthError(null);

      // Check if operation was aborted
      if (abortController?.signal?.aborted) {
        console.log('Auth check aborted');
        return;
      }

      const token = await asyncOperationWrapper.safeStorageGet('authToken');
      const userData = await asyncOperationWrapper.safeStorageGet('userData');

      if (token && userData) {
        try {
          // Use fast API service for instant auth check
          const response = await asyncOperationWrapper.safeNetworkRequest(
            () => fastApiService.getProfile(),
            { operationName: 'auth_check_profile', timeout: 10000 }
          );

          if (response.success && response.data) {
            // CRASH FIX: Check mounted before setState
            if (!isMounted.current) return;
            setUser(response.data);
            setIsAuthenticated(true);
            console.log('Auth check successful:', response.source);
          } else {
            // Fallback to stored data
            console.log('Using stored data as fallback');
            try {
              const storedUser = JSON.parse(userData);
              if (storedUser && typeof storedUser === 'object' && storedUser.email) {
                // CRASH FIX: Check mounted before setState
                if (!isMounted.current) return;
                setUser(storedUser);
                setIsAuthenticated(true);

                // 🔐 CRITICAL FIX: Set organization ID for data isolation
                if (storedUser.organizationId) {
                  const fastDatabase = require('../services/fastDatabase').default;
                  fastDatabase.setOrganizationId(storedUser.organizationId);
                  console.log(`🏢 Organization ID restored from storage: ${storedUser.organizationId}`);
                } else {
                  console.warn('⚠️  WARNING: User has no organization ID!');
                }

                console.log('Auth check successful using fallback stored data');
              } else{
                console.warn('Invalid stored user data, clearing auth');
                if (isMounted.current) await clearAuthData();
              }
            } catch (parseError) {
              console.warn('Failed to parse stored user data:', parseError.message);
              if (isMounted.current) await clearAuthData();
            }
          }
        } catch (serviceError) {
          console.log('Service auth check failed, using stored data:', serviceError.message);

          // Fallback to stored user data in offline mode
          try {
            const storedUser = JSON.parse(userData);
            if (storedUser && typeof storedUser === 'object' && storedUser.email) {
              // CRASH FIX: Check mounted before setState
              if (!isMounted.current) return;
              setUser(storedUser);
              setIsAuthenticated(true);

              // 🔐 CRITICAL FIX: Set organization ID when restoring session from storage
              // This prevents data leaks across organizations
              if (storedUser.organizationId) {
                const fastDatabase = require('../services/fastDatabase').default;
                fastDatabase.setOrganizationId(storedUser.organizationId);
                console.log(`🏢 Organization ID restored from storage: ${storedUser.organizationId}`);
              } else {
                console.warn('⚠️  WARNING: User has no organization ID - data isolation may fail!');
              }

              console.log('Auth check successful using offline data');
            } else {
              console.warn('Invalid offline user data, clearing auth');
              if (isMounted.current) await clearAuthData();
            }
          } catch (parseError) {
            console.warn('Failed to parse offline user data:', parseError.message);
            if (isMounted.current) await clearAuthData();
          }
        }
      } else {
        console.log('No stored auth data found');
      }
    } catch (error) {
      console.error('Auth check error:', error);
      // CRASH FIX: Check mounted before setState
      if (!isMounted.current) return;
      setAuthError(error.message);
      await clearAuthData();
    } finally {
      // CRASH FIX: Check mounted before setState
      if (isMounted.current) {
        setIsLoading(false);
      }
    }
  }, [clearAuthData]);

  const login = useCallback(async (email, password, organizationSlug = null) => {
    try {
      setIsLoading(true);
      setAuthError(null);

      if (!email || !password) {
        throw new Error('Email and password are required');
      }

      console.log('🔐 LOGIN ATTEMPT:', {
        email,
        hasPassword: !!password,
        passwordLength: password?.length,
        organizationSlug,
        timestamp: new Date().toISOString()
      });

      // OFFLINE-FIRST MODE: Always try local login first for instant access
      // This works for ALL users (demo and registered) whether online or offline
      console.log('🔄 [OFFLINE-FIRST] Attempting login with fastApiService (local SQLite)...');

      try {
        const localResponse = await fastApiService.login(email, password);

        if (localResponse.success && localResponse.data) {
          const { token, user } = localResponse.data;

          // ENHANCED LOGGING: Debug user data before storage
          console.log('═══════════════════════════════════════════════════');
          console.log('🔍 LOGIN - USER DATA FROM LOCAL DB');
          console.log('═══════════════════════════════════════════════════');
          console.log('Email:', user?.email);
          console.log('Role:', user?.role);
          console.log('Organization ID:', user?.organizationId);
          console.log('Organization (alt):', user?.organization_id);
          console.log('User ID:', user?.id);
          console.log('Full user keys:', Object.keys(user || {}));
          console.log('═══════════════════════════════════════════════════');

          // Store token and user data
          await asyncOperationWrapper.safeStorageSet('authToken', token);
          await asyncOperationWrapper.safeStorageSet('userData', user);

          setUser(user);
          setIsAuthenticated(true);

          // 🔐 CRITICAL: Set organization ID in fastDatabase for data isolation
          // Support both camelCase and snake_case
          const orgId = user.organizationId || user.organization_id;
          if (orgId) {
            const fastDatabase = require('../services/fastDatabase').default;
            fastDatabase.setOrganizationId(orgId);
            console.log('═══════════════════════════════════════════════════');
            console.log('🏢 ORGANIZATION ID SET AT LOGIN');
            console.log('═══════════════════════════════════════════════════');
            console.log('Organization ID:', orgId);
            console.log('User:', user.email);
            console.log('═══════════════════════════════════════════════════');
          } else {
            console.error('═══════════════════════════════════════════════════');
            console.error('🚨 CRITICAL ERROR: LOGIN USER HAS NO ORGANIZATION ID!');
            console.error('═══════════════════════════════════════════════════');
            console.error('User data:', JSON.stringify(user, null, 2));
            console.error('═══════════════════════════════════════════════════');
          }

          console.log(`✅ [OFFLINE-FIRST] Login successful via local database (${localResponse.source})`);
          console.log(`   User: ${user.email} | Role: ${user.role} | Org: ${user.organizationId}`);

          return {
            success: true,
            data: localResponse.data,
            isOffline: true,
            source: localResponse.source
          };
        }
      } catch (localError) {
        console.log('⚠️ [OFFLINE-FIRST] Local login failed:', localError.message);
        console.log('   Falling through to API login...');
      }

      // Try real API service first for multi-org support
      try {
        console.log('📡 Attempting login via REAL API (NestJS backend)...');
        console.log('🔍 API Request Details:', {
          endpoint: '/auth/login',
          email,
          hasPassword: !!password,
          passwordLength: password?.length,
          organizationSlug: organizationSlug || 'none'
        });

        const response = await asyncOperationWrapper.safeNetworkRequest(
          () => apiService.login(email, password, organizationSlug),
          { operationName: 'auth_login_api', timeout: 15000, retries: 1 }
        );

        console.log('🔍 [DEBUG] Response after asyncOperationWrapper:', {
          isNull: response === null,
          isUndefined: response === undefined,
          type: typeof response,
          hasAccessToken: response?.access_token,
          hasUser: response?.user,
          keys: response ? Object.keys(response) : []
        });

        // CRASH FIX: Check if response is null or invalid
        if (!response || typeof response !== 'object') {
          console.error('❌ Invalid API response:', response);
          throw new Error('Login failed: Invalid response from server. Please check your network connection.');
        }

        console.log('📥 API Response Received:', {
          hasAccessToken: !!response.access_token,
          hasUser: !!response.user,
          userEmail: response.user?.email,
          userRole: response.user?.role,
          organizationId: response.user?.organizationId,
          organizationName: response.user?.organization?.name
        });

        // Check for access_token (backend returns snake_case)
        if (!response.access_token) {
          console.error('❌ No access_token in response:', response);
          throw new Error(response.message || 'Login failed: Invalid credentials');
        }

        if (!response.user) {
          console.error('❌ No user data in response:', response);
          throw new Error('Login failed: No user data received');
        }

        if (response.access_token && response.user) {
          // PERFORMANCE FIX: Store only essential data synchronously for instant login
          // Move all slow operations to background
          await asyncOperationWrapper.safeStorageSet('authToken', response.access_token);
          await asyncOperationWrapper.safeStorageSet('userData', response.user);

          setUser(response.user);
          setIsAuthenticated(true);

          // 🔐 CRITICAL: Set organization ID in fastDatabase for data isolation
          if (response.user.organizationId) {
            const fastDatabase = require('../services/fastDatabase').default;
            fastDatabase.setOrganizationId(response.user.organizationId);
            console.log(`🏢 Organization ID set: ${response.user.organizationId}`);
          }

          console.log('✅ LOGIN SUCCESSFUL via REAL API');
          console.log('User:', response.user.email, '| Organization:', response.user.organization?.name, '| Org ID:', response.user.organizationId);
          console.log('💾 Token and user data stored successfully');
          console.log('⚡ INSTANT LOGIN - All background tasks moved to background');

          // LIGHTNING FAST LOGIN: Schedule ALL non-critical tasks for later
          // This ensures instant navigation without ANY blocking operations
          setImmediate(() => {
            // CRASH FIX: Wrap entire background operation in try-catch
            try {
              // Use Promise.allSettled to run all background tasks in parallel without blocking
              Promise.allSettled([
                // Task 1: Store credentials for offline login (MOVED TO BACKGROUND)
                (async () => {
                  try {
                    console.log('💾 [Background] Storing credentials for offline login...');
                    await authStorage.storeCredentials(email, password, response.user);
                    console.log('✅ [Background] Credentials stored for offline login capability');
                  } catch (error) {
                    console.warn('⚠️ [Background] Failed to store offline credentials:', error?.message || error);
                  }
                })(),

                // Task 2: Setup push notifications
                (async () => {
                  try {
                    console.log('🔔 [Background] Setting up push notifications...');
                    // CRASH FIX: Add timeout to notification setup (10 seconds max)
                    await Promise.race([
                      notificationService.setupNotifications(),
                      new Promise((_, reject) => setTimeout(() => reject(new Error('Notification setup timeout')), 10000))
                    ]);
                    console.log('✅ [Background] Push notifications ready');
                  } catch (error) {
                    console.warn('⚠️ [Background] Push notifications setup failed:', error?.message || error);
                  }
                })(),

                // Task 3: Perform initial sync
                (async () => {
                  try {
                    console.log('🔄 [Background] Starting data sync...');
                    // CRASH FIX: Add timeout to sync (30 seconds max)
                    const syncResult = await Promise.race([
                      syncService.performInitialSync(),
                      new Promise((_, reject) => setTimeout(() => reject(new Error('Sync timeout')), 30000))
                    ]);
                    if (syncResult?.success) {
                      console.log('✅ [Background] Data sync completed');
                    } else {
                      console.warn('⚠️ [Background] Sync skipped or failed - using cached data');
                    }
                  } catch (error) {
                    console.warn('⚠️ [Background] Sync error:', error?.message || error);
                  }
                })()
              ]).then(() => {
                console.log('✅ [Background] All post-login tasks completed');
              }).catch((error) => {
                // CRASH FIX: Log but don't crash on background task failures
                console.warn('⚠️ [Background] Some background tasks failed:', error?.message || error);
              });
            } catch (setImmediateError) {
              // CRASH FIX: Catch errors from setImmediate itself
              console.error('❌ [Background] Background task scheduling failed:', setImmediateError?.message || setImmediateError);
            }
          });

          return {
            success: true,
            data: response, // Include data object for LoginScreen validation
            isOffline: false,
            source: 'api'
          };
        } else {
          throw new Error('Invalid response from login service');
        }
      } catch (apiError) {
        console.log('❌ REAL API LOGIN FAILED:', apiError.message);
        console.log('   This could mean:');
        console.log('   1. Invalid email/password');
        console.log('   2. Network connection issue');
        console.log('   3. Backend server is down');

        // Check if this is an organization selection error
        // First check if error has originalData property (from updated API service)
        if (apiError.originalData && apiError.originalData.requiresOrgSelection && apiError.originalData.organizations) {
          console.log('Organization selection required (originalData):', apiError.originalData.organizations);
          return {
            success: false,
            requiresOrgSelection: true,
            organizations: apiError.originalData.organizations,
            error: 'Multiple organizations found. Please select one.'
          };
        }

        // Check if error message is an object
        if (apiError.message && typeof apiError.message === 'object' &&
            apiError.message.requiresOrgSelection && apiError.message.organizations) {
          console.log('Organization selection required (object):', apiError.message.organizations);
          return {
            success: false,
            requiresOrgSelection: true,
            organizations: apiError.message.organizations,
            error: 'Multiple organizations found. Please select one.'
          };
        }

        // Parse error message if it's a string containing JSON
        if (typeof apiError.message === 'string') {
          try {
            const errorData = JSON.parse(apiError.message);
            if (errorData.requiresOrgSelection && errorData.organizations) {
              console.log('Organization selection required (parsed):', errorData.organizations);
              return {
                success: false,
                requiresOrgSelection: true,
                organizations: errorData.organizations,
                error: 'Multiple organizations found. Please select one.'
              };
            }
          } catch (parseError) {
            console.log('Error parsing message:', parseError);
          }
        }

        // Check if user wants to use demo mode
        console.log('⚠️  Real API login failed. Checking if this is a demo account...');

        // Only fall back to demo mode if the email matches demo patterns
        const isDemoAccount = email.toLowerCase().includes('demo') ||
                            email.toLowerCase().includes('admin@poultry360.com') ||
                            email.toLowerCase().includes('owner@poultry360.com');

        if (!isDemoAccount) {
          // This is a real user account, don't fall back to demo mode
          console.log('❌ This is not a demo account. Real API login failed.');
          console.log('💡 TROUBLESHOOTING TIPS:');
          console.log('   - Check if you used the correct email and password');
          console.log('   - Make sure the backend server is running (port 3006)');
          console.log('   - Verify your network connection');
          console.log('   - If you just registered, try the exact credentials you used');

          // Return the actual error message from the API
          return {
            success: false,
            error: apiError.message || 'Login failed. Please check your credentials and try again.',
            apiError: true
          };
        }

        // For demo accounts, fall back to offline mode
        console.log('🎭 Demo account detected, falling back to offline demo mode...');
        const response = await asyncOperationWrapper.safeNetworkRequest(
          () => fastApiService.login(email, password),
          { operationName: 'auth_login_fallback', timeout: 15000, retries: 2 }
        );

        if (response.success && response.data) {
          const { token, user } = response.data;

          // Store token and user data
          await asyncOperationWrapper.safeStorageSet('authToken', token);
          await asyncOperationWrapper.safeStorageSet('userData', user);

          setUser(user);
          setIsAuthenticated(true);

          console.log(`✅ Login successful via DEMO MODE (${response.source})`);

          return {
            success: true,
            data: response.data, // Include data object for LoginScreen validation
            isOffline: response.isOffline || true,
            isDemoMode: true,
            source: response.source,
            willSyncLater: response.willSyncLater
          };
        } else {
          throw new Error(response.error || 'Demo login failed');
        }
      }
    } catch (error) {
      console.error('❌ LOGIN ERROR (final):', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown login error occurred';
      setAuthError(errorMessage);
      // CRASH FIX: Always return a valid result object with all expected fields
      return {
        success: false,
        error: errorMessage,
        isOffline: false,
        source: 'error'
      };
    } finally {
      setIsLoading(false);
    }
  }, [clearAuthData]);

  const register = useCallback(async (userData) => {
    try {
      setIsLoading(true);
      setAuthError(null);

      if (!userData || !userData.email) {
        throw new Error('User data with email is required');
      }

      // Check network status - registration requires internet
      const isOnline = networkService.getIsConnected();
      if (!isOnline) {
        console.log('❌ OFFLINE - Registration requires internet connection');
        return {
          success: false,
          error: 'Registration requires an internet connection. Please connect and try again.',
          isOffline: true,
          source: 'offline'
        };
      }

      // Try real API service first for registration
      try{
        // CRASH FIX: Wrap API call in try-catch to handle network failures gracefully
        let response;
        try {
          response = await asyncOperationWrapper.safeNetworkRequest(
            () => apiService.register(userData),
            { operationName: 'auth_register_api', timeout: 30000, retries: 2 } // CRASH FIX: Increased timeout to 30s, 2 retries
          );
        } catch (networkError) {
          console.error('❌ Registration network request failed:', networkError);
          // CRASH FIX: Check if this is a timeout error
          if (networkError.message?.includes('timeout') || networkError.code === 'ECONNABORTED') {
            throw new Error('Registration request timed out. The server may be slow or unreachable. Please try again.');
          }
          throw networkError; // Re-throw for outer catch
        }

        // CRASH FIX: Add comprehensive null/undefined checks
        if (!response) {
          throw new Error('Registration failed - no response from server. Please check your network connection.');
        }

        if (typeof response !== 'object') {
          throw new Error('Registration failed - invalid response format from server.');
        }

        // CRASH FIX: Check for access_token and user separately with helpful error messages
        if (!response.access_token) {
          console.error('❌ Registration response missing access_token:', response);
          throw new Error('Registration failed - authentication token not received. Please try again.');
        }

        if (!response.user) {
          console.error('❌ Registration response missing user data:', response);
          throw new Error('Registration failed - user data not received. Please try again.');
        }

        // Now safe to access properties
        if (response.access_token && response.user) {
          // DO NOT automatically log in after registration
          // Clear any stored auth data to ensure clean state
          // CRASH FIX: Add timeout and error handling to AsyncStorage operations
          try {
            // CRASH FIX: Clear storage with timeout protection (5 second max)
            await Promise.race([
              Promise.all([
                asyncOperationWrapper.safeStorageRemove('authToken'),
                asyncOperationWrapper.safeStorageRemove('userData')
              ]),
              new Promise((_, reject) => setTimeout(() => reject(new Error('Storage clear timeout')), 5000))
            ]);
          } catch (storageError) {
            console.warn('⚠️ Failed to clear auth storage (non-critical):', storageError.message);
            // Non-critical error - continue with registration success
          }

          setUser(null);
          setIsAuthenticated(false);

          console.log('Registration successful via real API - user must now login');

          return {
            success: true,
            requiresLogin: true,
            message: 'Account created successfully! Please login with your credentials.',
            isOffline: false,
            source: 'api'
          };
        } else {
          // CRASH FIX: Handle null/undefined response
          if (!response || typeof response !== 'object') {
            throw new Error('Registration failed - no response from server. Please try again.');
          }
          const errorMessage = response.error || response.message || 'Invalid response from registration service';
          throw new Error(errorMessage);
        }
      } catch (apiError) {
        console.error('❌ REAL API REGISTRATION FAILED:', apiError.message);
        console.error('   This means user data was NOT saved to the database!');
        console.error('   Possible causes:');
        console.error('   1. Backend server not reachable');
        console.error('   2. Database connection issue');
        console.error('   3. Invalid registration data');
        console.error('   4. Network connectivity problem');

        // CRITICAL FIX: Do NOT fall back to demo mode for real user registrations
        // Demo mode does NOT save to database and creates false success

        // Check if this is a demo/test account
        const isDemoAccount = userData.email?.toLowerCase().includes('demo') ||
                            userData.email?.toLowerCase().includes('test@poultry360.com');

        if (!isDemoAccount) {
          // This is a REAL user - return error, do NOT give false success
          console.error('❌ Cannot register real user - backend unreachable');
          throw new Error(
            apiError.message ||
            'Unable to reach registration server. Please check your internet connection and try again.'
          );
        }

        // Only for demo accounts: Fall back to demo mode with clear warning
        console.warn('⚠️ Demo account detected - using offline demo mode');
        console.warn('   NOTE: This registration will NOT persist after app restart');

        const response = await asyncOperationWrapper.safeNetworkRequest(
          () => fastApiService.register(userData),
          { operationName: 'auth_register_fallback', timeout: 15000, retries: 1, offline: true }
        );

        if (response.success && response.data) {
          // DO NOT automatically log in after registration (even in offline mode)
          // Clear any stored auth data to ensure clean state
          await asyncOperationWrapper.safeStorageRemove('authToken');
          await asyncOperationWrapper.safeStorageRemove('userData');

          setUser(null);
          setIsAuthenticated(false);

          console.log(`Demo registration via ${response.source} (offline fallback) - user must now login`);

          return {
            success: true,
            requiresLogin: true,
            message: 'Demo account created! Note: This is temporary and will not persist. Please login.',
            isOffline: true,
            isDemoMode: true,
            source: response.source,
            willSyncLater: false // Demo mode data does NOT sync
          };
        } else {
          throw new Error(response.error || 'Registration failed');
        }
      }
    } catch (error) {
      console.error('Registration error:', error);
      const errorMessage = error?.message || error?.toString() || 'Unknown registration error occurred';
      setAuthError(errorMessage);
      // CRASH FIX: Always return a valid result object with all expected fields
      return {
        success: false,
        error: errorMessage,
        requiresLogin: false,
        isOffline: false,
        source: 'error'
      };
    } finally {
      setIsLoading(false);
    }
  }, [clearAuthData]);

  const logout = useCallback(async () => {
    try {
      console.log('🚪 Logout initiated...');
      setIsLoading(true);
      setAuthError(null);

      // FIX: Do NOT clear local database on logout
      // The database contains server data that belongs to the user's account
      // When they login again, they should see their data immediately from cache
      // The data will be refreshed from the server in the background
      console.log('💾 Preserving local database - data will be available on next login');

      // Clear auth data only (token and user info)
      await clearAuthData();

      console.log('✅ Logout completed - user should be redirected to login');
    } catch (error) {
      console.error('❌ Logout error:', error);
      setAuthError(error.message);

      // Force clear even on error
      try {
        setUser(null);
        setIsAuthenticated(false);
        console.log('✅ Force logout completed');
      } catch (forceError) {
        console.error('❌ Force logout failed:', forceError);
      }
    } finally {
      setIsLoading(false);
    }
  }, [clearAuthData]);

  const updateUser = useCallback(async (userData) => {
    try {
      setUser(userData);
      await asyncOperationWrapper.safeStorageSet('userData', userData);
    } catch (error) {
      console.error('Error updating user data:', error);
    }
  }, []);

  // Get current auth state
  const getAuthState = useCallback(() => ({
    user,
    isLoading,
    isAuthenticated,
    authError,
    hasError: !!authError
  }), [user, isLoading, isAuthenticated, authError]);

  // Retry authentication in case of temporary failures
  const retryAuth = useCallback(async () => {
    setAuthError(null);
    await checkAuthStatus();
  }, [checkAuthStatus]);

  const value = useMemo(() => ({
    user,
    isLoading,
    isAuthenticated,
    authError,
    login,
    register,
    logout,
    updateUser,
    checkAuthStatus,
    retryAuth,
    getAuthState,
  }), [user, isLoading, isAuthenticated, authError]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};