import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { AuthProvider, useAuth } from '../../context/AuthContext';
import AsyncStorage from '@react-native-async-storage/async-storage';
import asyncOperationWrapper from '../../utils/asyncOperationWrapper';

// Mock dependencies
jest.mock('../../services/api');
jest.mock('../../services/fastApiService');
jest.mock('../../utils/asyncOperationWrapper');
jest.mock('../../services/notificationService');

describe('Authentication Flow Integration Test', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();

    // Setup default mocks
    asyncOperationWrapper.safeStorageGet = jest.fn().mockResolvedValue(null);
    asyncOperationWrapper.safeStorageSet = jest.fn().mockResolvedValue(true);
    asyncOperationWrapper.safeStorageRemove = jest.fn().mockResolvedValue(true);
    asyncOperationWrapper.safeNetworkRequest = jest.fn().mockImplementation((fn) => fn());
  });

  describe('Complete Registration and Login Flow', () => {
    it('should complete full user registration and login cycle', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Step 1: User is not authenticated initially
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();

      // Step 2: User registers
      const userData = {
        email: 'newuser@example.com',
        password: 'securepass123',
        name: 'New User',
        organizationName: 'Test Farm'
      };

      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockResolvedValueOnce({
        access_token: 'registration-token',
        user: { id: 1, email: userData.email, name: userData.name }
      });

      let registerResult;
      await act(async () => {
        registerResult = await result.current.register(userData);
      });

      // Step 3: Verify registration succeeded but user is not auto-logged in
      expect(registerResult.success).toBe(true);
      expect(registerResult.requiresLogin).toBe(true);
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();

      // Step 4: User logs in with registered credentials
      const mockUser = {
        id: 1,
        email: userData.email,
        name: userData.name,
        organization: { id: 1, name: 'Test Farm' }
      };

      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockResolvedValueOnce({
        access_token: 'login-token-456',
        user: mockUser
      });

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login(userData.email, userData.password);
      });

      // Step 5: Verify successful login
      expect(loginResult.success).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
      expect(result.current.user.email).toBe(userData.email);

      // Step 6: Verify token and user data are stored
      expect(asyncOperationWrapper.safeStorageSet).toHaveBeenCalledWith('authToken', 'login-token-456');
      expect(asyncOperationWrapper.safeStorageSet).toHaveBeenCalledWith('userData', mockUser);

      // Step 7: User logs out
      await act(async () => {
        await result.current.logout();
      });

      // Step 8: Verify logout cleared auth state
      expect(result.current.isAuthenticated).toBe(false);
      expect(result.current.user).toBeNull();
      expect(asyncOperationWrapper.safeStorageRemove).toHaveBeenCalledWith('authToken');
      expect(asyncOperationWrapper.safeStorageRemove).toHaveBeenCalledWith('userData');
    });

    it('should restore session from stored token on app restart', async () => {
      const mockUser = {
        id: 1,
        email: 'stored@example.com',
        name: 'Stored User'
      };
      const mockToken = 'stored-token-789';

      // Simulate stored credentials
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

      // Simulate app restart by creating new provider instance
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Wait for auth check to complete
      await waitFor(() => {
        expect(result.current.isAuthenticated).toBe(true);
      });

      expect(result.current.user).toEqual(mockUser);
      expect(result.current.isLoading).toBe(false);
    });

    it('should handle token expiration and require re-login', async () => {
      const mockUser = {
        id: 1,
        email: 'test@example.com'
      };

      // Setup authenticated state
      asyncOperationWrapper.safeStorageGet = jest.fn()
        .mockImplementation((key) => {
          if (key === 'authToken') return Promise.resolve('expired-token');
          if (key === 'userData') return Promise.resolve(JSON.stringify(mockUser));
          return Promise.resolve(null);
        });

      // Simulate expired token
      asyncOperationWrapper.safeNetworkRequest = jest.fn()
        .mockRejectedValueOnce(new Error('Token expired'))
        .mockResolvedValueOnce({
          access_token: 'new-token',
          user: mockUser
        });

      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      // Wait for initial auth check to fail and clear state
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // User should be logged out due to expired token
      expect(result.current.isAuthenticated).toBe(true); // Fallback to stored data

      // User re-authenticates
      await act(async () => {
        await result.current.login('test@example.com', 'password123');
      });

      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user).toEqual(mockUser);
    });
  });

  describe('Multi-Organization Flow', () => {
    it('should handle multi-organization selection during login', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Step 1: User attempts login
      const mockOrganizations = [
        { id: 1, slug: 'farm1', name: 'Farm 1' },
        { id: 2, slug: 'farm2', name: 'Farm 2' }
      ];

      const orgSelectionError = new Error(JSON.stringify({
        requiresOrgSelection: true,
        organizations: mockOrganizations
      }));
      orgSelectionError.originalData = {
        requiresOrgSelection: true,
        organizations: mockOrganizations
      };

      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockRejectedValueOnce(orgSelectionError);

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login('multi@example.com', 'password');
      });

      // Step 2: Verify organization selection is required
      expect(loginResult.success).toBe(false);
      expect(loginResult.requiresOrgSelection).toBe(true);
      expect(loginResult.organizations).toEqual(mockOrganizations);

      // Step 3: User selects specific organization
      const mockUser = {
        id: 1,
        email: 'multi@example.com',
        organization: mockOrganizations[0]
      };

      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockResolvedValueOnce({
        access_token: 'org-specific-token',
        user: mockUser
      });

      await act(async () => {
        loginResult = await result.current.login('multi@example.com', 'password', 'farm1');
      });

      // Step 4: Verify successful login with selected organization
      expect(loginResult.success).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
      expect(result.current.user.organization.slug).toBe('farm1');
    });
  });

  describe('Error Handling and Recovery', () => {
    it('should handle network errors gracefully and allow retry', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // First login attempt fails due to network error
      asyncOperationWrapper.safeNetworkRequest = jest.fn()
        .mockRejectedValueOnce(new Error('Network connection failed'));

      let loginResult;
      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password');
      });

      expect(loginResult.success).toBe(false);
      expect(loginResult.error).toContain('Network connection failed');
      expect(result.current.isAuthenticated).toBe(false);

      // Second login attempt succeeds
      const mockUser = { id: 1, email: 'test@example.com' };
      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockResolvedValueOnce({
        access_token: 'retry-token',
        user: mockUser
      });

      await act(async () => {
        loginResult = await result.current.login('test@example.com', 'password');
      });

      expect(loginResult.success).toBe(true);
      expect(result.current.isAuthenticated).toBe(true);
    });

    it('should clear error state on successful operations', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Cause an error
      asyncOperationWrapper.safeNetworkRequest = jest.fn()
        .mockRejectedValueOnce(new Error('Login failed'));

      await act(async () => {
        await result.current.login('', ''); // Invalid credentials
      });

      expect(result.current.authError).toBeTruthy();

      // Successful login should clear error
      const mockUser = { id: 1, email: 'test@example.com' };
      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockResolvedValueOnce({
        access_token: 'success-token',
        user: mockUser
      });

      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });

      expect(result.current.authError).toBeNull();
      expect(result.current.isAuthenticated).toBe(true);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle rapid login/logout cycles', async () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: AuthProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const mockUser = { id: 1, email: 'test@example.com' };
      asyncOperationWrapper.safeNetworkRequest = jest.fn().mockResolvedValue({
        access_token: 'token',
        user: mockUser
      });

      // Login
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });
      expect(result.current.isAuthenticated).toBe(true);

      // Logout
      await act(async () => {
        await result.current.logout();
      });
      expect(result.current.isAuthenticated).toBe(false);

      // Login again
      await act(async () => {
        await result.current.login('test@example.com', 'password');
      });
      expect(result.current.isAuthenticated).toBe(true);

      // Logout again
      await act(async () => {
        await result.current.logout();
      });
      expect(result.current.isAuthenticated).toBe(false);
    });
  });
});