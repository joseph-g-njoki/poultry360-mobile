import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import apiService from '../../services/api';
import fastApiService from '../../services/fastApiService';
import asyncOperationWrapper from '../../utils/asyncOperationWrapper';
import notificationService from '../../services/notificationService';

// Mock all dependencies
jest.mock('../../services/api');
jest.mock('../../services/fastApiService');
jest.mock('../../utils/asyncOperationWrapper');
jest.mock('../../services/notificationService');

describe('AuthContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();

    // Setup default mocks
    asyncOperationWrapper.safeStorageGet = jest.fn().mockResolvedValue(null);
    asyncOperationWrapper.safeStorageSet = jest.fn().mockResolvedValue(true);
    asyncOperationWrapper.safeStorageRemove = jest.fn().mockResolvedValue(true);
    asyncOperationWrapper.safeNetworkRequest = jest.fn().mockImplementation((fn) => fn());

    notificationService.setupNotifications = jest.fn().mockResolvedValue(true);
  });

  describe('Initial State', () => {
    it('should provide initial auth state', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.authError).toBeNull();
    });

    it('should throw error when useAuth is used outside provider', () => {
      // Suppress console error for this test
      const consoleError = console.error;
      console.error = jest.fn();

      expect(() => {
        renderHook(() => useAuth());
      }).toThrow('useAuth must be used within an AuthProvider');

      console.error = consoleError;
    });
  });

  describe('Login Flow', () => {
    it('should login successfully with valid credentials via API', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        name: 'Test User',
        organization: { id: 1, name: 'Test Org' }
      };

      const mockResponse = {
        access_token: 'test-token-123',
        user: mockUser
      };

      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password123');
      });

      expect(loginResult.success).toBe(true);
      expect(loginResult.source).toBe('api');
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(asyncOperationWrapper.safeStorageSet).toHaveBeenCalledWith('authToken', 'test-token-123');
      expect(asyncOperationWrapper.safeStorageSet).toHaveBeenCalledWith('userData', mockUser);
      expect(notificationService.setupNotifications).toHaveBeenCalled();
    });

    it('should handle login failure with invalid credentials', async () => {
      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockRejectedValue(
        new Error('Invalid credentials')
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login('wrong@example.com', 'wrongpass');
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toContain('Invalid credentials');
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should require email and password', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login('', '');
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toContain('Email and password are required');
    });

    it('should handle organization selection requirement', async () => {
      const mockOrganizations = [
        { id: 1, slug: 'org1', name: 'Organization 1' },
        { id: 2, slug: 'org2', name: 'Organization 2' }
      ];

      const errorWithOrgs = new Error(JSON.stringify({
        requiresOrgSelection: true,
        organizations: mockOrganizations
      }));
      errorWithOrgs.originalData = {
        requiresOrgSelection: true,
        organizations: mockOrganizations
      };

      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockRejectedValue(errorWithOrgs);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login('multi@example.com', 'password123');
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.requiresOrgSelection).toBe(true);
      expect(loginResult.organizations).toEqual(mockOrganizations);
    });

    it('should login with specific organization slug', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com',
        organization: { id: 1, slug: 'org1', name: 'Organization 1' }
      };

      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockResolvedValue({
        access_token: 'test-token',
        user: mockUser
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login('test@example.com', 'password123', 'org1');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user.organization.slug).toBe('org1');
    });
  });

  describe('Registration Flow', () => {
    it('should register successfully via API', async () => {
      const userData = {
        email: 'newuser@example.com',
        password: 'password123',
        name: 'New User',
        organizationName: 'New Org'
      };

      const mockResponse = {
        access_token: 'test-token',
        user: { id: 1, email: userData.email }
      };

      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register(userData);
      });

      expect(registerResult.success).toBe(true);
      expect(registerResult.requiresLogin).toBe(true);
      expect(registerResult.message).toContain('created successfully');
      // Should NOT auto-login after registration
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
    });

    it('should require email in user data', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register({});
      });

      expect(registerResult.success).toBe(false);
      expect(registerResult.error).toContain('User data with email is required');
    });

    it('should handle registration errors', async () => {
      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockRejectedValue(
        new Error('Email already exists')
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register({
          email: 'existing@example.com',
          password: 'password123'
        });
      });

      expect(registerResult.success).toBe(false);
      expect(registerResult.error).toContain('Email already exists');
    });
  });

  describe('Logout Flow', () => {
    it('should logout and clear all auth data', async () => {
      // Setup authenticated state
      const mockUser = { id: 1, email: 'test@example.com' };
      asyncOperationWrapper.safeStorageGet = jest.fn()
        .mockResolvedValueOnce('test-token')
        .mockResolvedValueOnce(JSON.stringify(mockUser));

      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockResolvedValue({
        success: true,
        data: mockUser
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      // Perform logout
      await act(async () => {
        await result.current.logout();
      });

      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(asyncOperationWrapper.safeStorageRemove).toHaveBeenCalledWith('authToken');
      expect(asyncOperationWrapper.safeStorageRemove).toHaveBeenCalledWith('userData');
    });
  });

  describe('Token Refresh and Session Persistence', () => {
    it('should restore session from stored token on app start', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      const mockToken = 'stored-token-123';

      asyncOperationWrapper.safeStorageGet = jest.fn()
        .mockImplementation((key) => {
          if (key === 'authToken') return Promise.resolve(mockToken);
          if (key === 'userData') return Promise.resolve(JSON.stringify(mockUser));
          return Promise.resolve(null);
        });

      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockResolvedValue({
        success: true,
        data: mockUser
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isLoading).toBe(false);
    });

    it('should fallback to stored data when profile fetch fails', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };

      asyncOperationWrapper.safeStorageGet = jest.fn()
        .mockImplementation((key) => {
          if (key === 'authToken') return Promise.resolve('test-token');
          if (key === 'userData') return Promise.resolve(JSON.stringify(mockUser));
          return Promise.resolve(null);
        });

      // Network request fails (offline mode)
      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockRejectedValue(
        new Error('Network error')
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(result.current.user).toEqual(mockUser);
    });

    it('should clear auth data when stored token is invalid', async () => {
      asyncOperationWrapper.safeStorageGet = jest.fn()
        .mockImplementation((key) => {
          if (key === 'authToken') return Promise.resolve('invalid-token');
          if (key === 'userData') return Promise.resolve('invalid-json');
          return Promise.resolve(null);
        });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(false);
      });

      expect(result.current.user).toBeNull();
      expect(asyncOperationWrapper.safeStorageRemove).toHaveBeenCalled();
    });
  });

  describe('User Update', () => {
    it('should update user data and persist to storage', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };
      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockResolvedValue({
        access_token: 'test-token',
        user: mockUser
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      const updatedUser = { ...mockUser, name: 'Updated Name' };

      await act(async () => {
        await result.current.updateUser(updatedUser);
      });

      expect(result.current.user).toEqual(updatedUser);
      expect(asyncOperationWrapper.safeStorageSet).toHaveBeenCalledWith('userData', updatedUser);
    });
  });

  describe('Auth State Management', () => {
    it('should provide complete auth state via getAuthState', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      const authState = result.current.getAuthState();

      expect(authState).toHaveProperty('user');
      expect(authState).toHaveProperty('isLoading');
      expect(authState).toHaveProperty('isAuthenticated');
      expect(authState).toHaveProperty('authError');
      expect(authState).toHaveProperty('hasError');
    });

    it('should retry authentication on retryAuth call', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };

      asyncOperationWrapper.safeStorageGet = jest.fn()
        .mockImplementation((key) => {
          if (key === 'authToken') return Promise.resolve('test-token');
          if (key === 'userData') return Promise.resolve(JSON.stringify(mockUser));
          return Promise.resolve(null);
        });

      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockResolvedValue({
        success: true,
        data: mockUser
      });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.retryAuth();
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.authError).toBeNull();
    });
  });

  describe('Error Handling', () => {
    it('should set authError on login failure', async () => {
      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockRejectedValue(
        new Error('Network timeout')
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.authError).toContain('Network timeout');
    });

    it('should clear authError on successful login', async () => {
      const mockUser = { id: 1, email: 'test@example.com' };

      // First login fails
      asyncOperationWrapper.safeNetworkRequest = jest.fn()
        .mockRejectedValueOnce(new Error('Error'))
        .mockResolvedValueOnce({ access_token: 'token', user: mockUser });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      // First attempt - fail
      await act(async () => {
        await result.current.login('test@example.com', 'wrong');
      });
      expect(result.current.authError).toBeTruthy();

      // Second attempt - succeed
      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.authError).toBeNull();
    });
  });

  describe('Demo Mode Fallback', () => {
    it('should fallback to demo mode for demo accounts', async () => {
      // API fails
      asyncOperationWrapper.safeNetworkRequest = jest.fn()
        .mockRejectedValueOnce(new Error('API Error'))
        .mockResolvedValueOnce({
          success: true,
          data: {
            token: 'demo-token',
            user: { id: 1, email: 'demo@poultry360.com' }
          },
          source: 'offline'
        });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login('demo@poultry360.com', 'demo');
      });

      expect(loginResult.success).toBe(true);
      expect(loginResult.isDemoMode).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should not fallback to demo mode for non-demo accounts', async () => {
      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockRejectedValue(
        new Error('API Error')
      );

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => expect(result.current.isLoading).toBe(false));

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login('real@example.com', 'password');
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.isDemoMode).toBeUndefined();
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});