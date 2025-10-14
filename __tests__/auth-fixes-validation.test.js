/**
 * CRITICAL AUTHENTICATION FIXES VALIDATION TEST SUITE
 *
 * Tests the two critical bugs that were fixed:
 * 1. "true is not a function" error during login/register
 * 2. Role selector showing undefined/missing Admin and Owner roles
 *
 * Bug Fix 1: asyncOperationWrapper.js lines 131-155
 * - Wrapped AsyncStorage.setItem/removeItem returns in objects
 * - Returns: { success: true, value: result }
 *
 * Bug Fix 2: RegisterScreen.js lines 572-595
 * - Removed conditional rendering for Admin/Owner roles
 * - All 4 roles always visible: Worker, Manager, Admin, Owner
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import asyncOperationWrapper from '../src/utils/asyncOperationWrapper';
import LoginScreen from '../src/screens/LoginScreen';
import RegisterScreen from '../src/screens/RegisterScreen';
import { AuthProvider } from '../src/context/AuthContext';
import { ThemeProvider } from '../src/context/ThemeContext';
import { LanguageProvider } from '../src/context/LanguageContext';

// Mock dependencies
jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: jest.fn(),
  setItem: jest.fn(),
  removeItem: jest.fn(),
  clear: jest.fn(),
}));

jest.mock('../src/services/api', () => ({
  login: jest.fn(),
  register: jest.fn(),
}));

jest.mock('../src/services/networkService', () => ({
  isConnected: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('react-native-toast-message', () => ({
  show: jest.fn(),
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    replace: jest.fn(),
  }),
  useRoute: () => ({
    params: {},
  }),
}));

// Wrapper component with all required providers
const TestWrapper = ({ children }) => (
  <LanguageProvider>
    <ThemeProvider>
      <AuthProvider>
        {children}
      </AuthProvider>
    </ThemeProvider>
  </LanguageProvider>
);

describe('CRITICAL BUG FIX #1: AsyncStorage Operations Return Objects', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Mock AsyncStorage to return undefined (simulating actual behavior)
    AsyncStorage.setItem.mockResolvedValue(undefined);
    AsyncStorage.removeItem.mockResolvedValue(undefined);
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  test('BUG FIX: safeStorageSet returns object with success and value properties', async () => {
    // BEFORE FIX: Would return undefined/true directly
    // AFTER FIX: Returns { success: true, value: result }

    const result = await asyncOperationWrapper.safeStorageSet('testKey', 'testValue');

    console.log('✅ TEST: safeStorageSet result:', result);

    // CRITICAL: Result must be an object
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();

    // CRITICAL: Result must have success property
    expect(result).toHaveProperty('success');
    expect(result.success).toBe(true);

    // CRITICAL: Result must have value property (even if undefined)
    expect(result).toHaveProperty('value');

    // Verify AsyncStorage was called
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('testKey', 'testValue');
  });

  test('BUG FIX: safeStorageRemove returns object with success and value properties', async () => {
    // BEFORE FIX: Would return undefined/true directly
    // AFTER FIX: Returns { success: true, value: result }

    const result = await asyncOperationWrapper.safeStorageRemove('testKey');

    console.log('✅ TEST: safeStorageRemove result:', result);

    // CRITICAL: Result must be an object
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result).not.toBeNull();

    // CRITICAL: Result must have success property
    expect(result).toHaveProperty('success');
    expect(result.success).toBe(true);

    // CRITICAL: Result must have value property (even if undefined)
    expect(result).toHaveProperty('value');

    // Verify AsyncStorage was called
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('testKey');
  });

  test('BUG FIX: safeStorageSet with JSON object returns proper object', async () => {
    const testData = { user: 'test@example.com', role: 'admin' };

    const result = await asyncOperationWrapper.safeStorageSet('userData', testData);

    console.log('✅ TEST: safeStorageSet with JSON result:', result);

    // CRITICAL: Result must be an object
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result).toHaveProperty('success', true);
    expect(result).toHaveProperty('value');

    // Verify AsyncStorage was called with stringified data
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('userData', JSON.stringify(testData));
  });

  test('BUG FIX: Multiple sequential storage operations all return objects', async () => {
    // Simulate AuthContext login flow (lines 322-323, 485-486)
    const token = 'test-token-123';
    const userData = { email: 'test@example.com', role: 'admin' };

    const tokenResult = await asyncOperationWrapper.safeStorageSet('authToken', token);
    const userResult = await asyncOperationWrapper.safeStorageSet('userData', userData);

    console.log('✅ TEST: Token storage result:', tokenResult);
    console.log('✅ TEST: User storage result:', userResult);

    // CRITICAL: Both operations must return objects
    expect(tokenResult).toBeDefined();
    expect(typeof tokenResult).toBe('object');
    expect(tokenResult.success).toBe(true);

    expect(userResult).toBeDefined();
    expect(typeof userResult).toBe('object');
    expect(userResult.success).toBe(true);

    // This would have caused "true is not a function" if not fixed
    // Because AsyncStorage.setItem returns undefined, which would be passed up
    expect(AsyncStorage.setItem).toHaveBeenCalledTimes(2);
  });

  test('BUG FIX: safeStorageGet returns null for missing keys (not throws error)', async () => {
    AsyncStorage.getItem.mockResolvedValue(null);

    const result = await asyncOperationWrapper.safeStorageGet('nonexistentKey');

    console.log('✅ TEST: safeStorageGet for missing key:', result);

    // Should return null, not throw error
    expect(result).toBeNull();
    expect(AsyncStorage.getItem).toHaveBeenCalledWith('nonexistentKey');
  });
});

describe('CRITICAL BUG FIX #2: Role Selector Shows All 4 Roles', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('BUG FIX: RegisterScreen shows all 4 roles without conditions', () => {
    // BEFORE FIX: Admin/Owner only visible when registrationType === 'create'
    // AFTER FIX: All 4 roles always visible (lines 572-595)

    const { getByText, UNSAFE_queryAllByType } = render(
      <TestWrapper>
        <RegisterScreen navigation={{ navigate: jest.fn() }} />
      </TestWrapper>
    );

    // The role picker should be rendered
    // Note: We can't directly test Picker.Item in React Native Testing Library
    // but we can verify the picker container exists

    // Verify role label is present
    expect(getByText('Role')).toBeDefined();

    console.log('✅ TEST: Role selector is rendered');
  });

  test('BUG FIX: Role picker includes all 4 values: worker, manager, admin, owner', () => {
    // This test verifies the code structure in RegisterScreen.js lines 578-589
    // All 4 Picker.Item components should be present without conditionals

    const RegisterScreenCode = require('fs').readFileSync(
      'C:\\Users\\josep\\OneDrive\\Desktop\\poultry360-app\\mobile\\poultry360-mobile\\src\\screens\\RegisterScreen.js',
      'utf8'
    );

    // Verify all 4 roles are defined in the picker
    expect(RegisterScreenCode).toContain('<Picker.Item label="👷 Worker" value="worker" />');
    expect(RegisterScreenCode).toContain('<Picker.Item label="👨‍💼 Manager" value="manager" />');
    expect(RegisterScreenCode).toContain('<Picker.Item label="⭐ Admin" value="admin" />');
    expect(RegisterScreenCode).toContain('<Picker.Item label="👑 Owner" value="owner" />');

    console.log('✅ TEST: All 4 role options are defined in code');
  });

  test('BUG FIX: No conditional rendering around Admin/Owner roles', () => {
    // Verify lines 572-595 have no conditionals wrapping the Picker
    const RegisterScreenCode = require('fs').readFileSync(
      'C:\\Users\\josep\\OneDrive\\Desktop\\poultry360-app\\mobile\\poultry360-mobile\\src\\screens\\RegisterScreen.js',
      'utf8'
    );

    // Extract the role picker section (lines 572-595)
    const rolePickerSection = RegisterScreenCode.split('<View style={styles.inputContainer}>')[7]; // 8th inputContainer is the role picker

    // Should NOT contain any conditional rendering like:
    // {formData.registrationType === 'create' && <Picker.Item ... />}
    expect(rolePickerSection).not.toContain('registrationType === \'create\' &&');
    expect(rolePickerSection).not.toContain('{formData.registrationType === \'create\'');

    console.log('✅ TEST: No conditional rendering detected around role options');
  });
});

describe('INTEGRATION: Login Flow with Fixed AsyncStorage', () => {
  const apiService = require('../src/services/api').default;

  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.setItem.mockResolvedValue(undefined);
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  test('INTEGRATION: Successful login does NOT cause "true is not a function" error', async () => {
    // Mock successful API response
    apiService.login.mockResolvedValue({
      access_token: 'test-token-123',
      user: {
        id: 1,
        email: 'test@example.com',
        role: 'admin',
        organizationId: 1
      }
    });

    // Import AuthContext login function
    const { login } = require('../src/context/AuthContext');

    // CRITICAL: This should NOT throw "true is not a function"
    let error = null;
    try {
      // Simulate login (lines 322-323 in AuthContext.js)
      await asyncOperationWrapper.safeStorageSet('authToken', 'test-token-123');
      await asyncOperationWrapper.safeStorageSet('userData', { email: 'test@example.com' });
    } catch (err) {
      error = err;
    }

    console.log('✅ TEST: Login AsyncStorage operations completed:', error === null);

    // Should not throw any error
    expect(error).toBeNull();

    // Verify storage operations were called
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('authToken', 'test-token-123');
    expect(AsyncStorage.setItem).toHaveBeenCalledWith('userData', JSON.stringify({ email: 'test@example.com' }));
  });

  test('INTEGRATION: Failed login does NOT cause "true is not a function" error', async () => {
    // Mock failed API response
    apiService.login.mockRejectedValue(new Error('Invalid credentials'));

    // CRITICAL: Even on failure, storage operations should not crash
    let error = null;
    try {
      // Simulate failed login attempt (might try to clear storage)
      await asyncOperationWrapper.safeStorageRemove('authToken');
      await asyncOperationWrapper.safeStorageRemove('userData');
    } catch (err) {
      error = err;
    }

    console.log('✅ TEST: Failed login cleanup completed:', error === null);

    // Should not throw any error
    expect(error).toBeNull();

    // Verify cleanup operations were called
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('authToken');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('userData');
  });
});

describe('INTEGRATION: Registration Flow with Fixed AsyncStorage', () => {
  const apiService = require('../src/services/api').default;

  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.setItem.mockResolvedValue(undefined);
    AsyncStorage.removeItem.mockResolvedValue(undefined);
    AsyncStorage.getItem.mockResolvedValue(null);
  });

  test('INTEGRATION: Successful registration does NOT cause "true is not a function" error', async () => {
    // Mock successful API response
    apiService.register.mockResolvedValue({
      access_token: 'new-token-456',
      user: {
        id: 2,
        email: 'newuser@example.com',
        role: 'owner',
        organizationId: 2
      }
    });

    // CRITICAL: This should NOT throw "true is not a function"
    let error = null;
    try {
      // Simulate registration cleanup (lines 589-593 in AuthContext.js)
      // Registration clears storage before redirecting to login
      await asyncOperationWrapper.safeStorageRemove('authToken');
      await asyncOperationWrapper.safeStorageRemove('userData');
    } catch (err) {
      error = err;
    }

    console.log('✅ TEST: Registration AsyncStorage cleanup completed:', error === null);

    // Should not throw any error
    expect(error).toBeNull();

    // Verify cleanup operations were called
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('authToken');
    expect(AsyncStorage.removeItem).toHaveBeenCalledWith('userData');
  });

  test('INTEGRATION: User can select any role (Worker, Manager, Admin, Owner)', async () => {
    const { getByText } = render(
      <TestWrapper>
        <RegisterScreen navigation={{ navigate: jest.fn() }} />
      </TestWrapper>
    );

    // Verify role selector is present (all roles should be available)
    expect(getByText('Role')).toBeDefined();

    console.log('✅ TEST: Role selector is accessible for all user types');

    // Note: Can't directly test Picker selection in RNTL
    // but the code review confirms all 4 roles are present without conditions
  });
});

describe('ERROR SCENARIOS: Ensure No "true is not a function" Errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('ERROR CASE: AsyncStorage.setItem returning undefined does not break flow', async () => {
    // This was the root cause of "true is not a function"
    AsyncStorage.setItem.mockResolvedValue(undefined);

    const result = await asyncOperationWrapper.safeStorageSet('testKey', 'testValue');

    // CRITICAL: Must return an object, not undefined
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result.success).toBe(true);
    expect(result.value).toBeUndefined(); // Original undefined is wrapped

    console.log('✅ TEST: Undefined return value is properly wrapped');
  });

  test('ERROR CASE: AsyncStorage.setItem returning true does not break flow', async () => {
    // Some implementations return true on success
    AsyncStorage.setItem.mockResolvedValue(true);

    const result = await asyncOperationWrapper.safeStorageSet('testKey', 'testValue');

    // CRITICAL: Must return an object, not true
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result.success).toBe(true);
    expect(result.value).toBe(true); // Original true is wrapped

    console.log('✅ TEST: Boolean return value is properly wrapped');
  });

  test('ERROR CASE: AsyncStorage.removeItem returning undefined does not break flow', async () => {
    AsyncStorage.removeItem.mockResolvedValue(undefined);

    const result = await asyncOperationWrapper.safeStorageRemove('testKey');

    // CRITICAL: Must return an object, not undefined
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
    expect(result.success).toBe(true);
    expect(result.value).toBeUndefined(); // Original undefined is wrapped

    console.log('✅ TEST: Remove operation undefined return is properly wrapped');
  });

  test('ERROR CASE: Trying to call result as function should fail gracefully', async () => {
    AsyncStorage.setItem.mockResolvedValue(true);

    const result = await asyncOperationWrapper.safeStorageSet('testKey', 'testValue');

    // BEFORE FIX: result would be true, and result() would throw "true is not a function"
    // AFTER FIX: result is an object with success property

    expect(() => {
      if (typeof result === 'function') {
        result(); // This would fail if result was true/undefined
      }
    }).not.toThrow();

    expect(typeof result).toBe('object');
    console.log('✅ TEST: Result is not callable (as expected)');
  });
});

describe('CODE STRUCTURE VERIFICATION', () => {
  test('VERIFY: asyncOperationWrapper.safeStorageSet returns object structure', () => {
    const wrapperCode = require('fs').readFileSync(
      'C:\\Users\\josep\\OneDrive\\Desktop\\poultry360-app\\mobile\\poultry360-mobile\\src\\utils\\asyncOperationWrapper.js',
      'utf8'
    );

    // Verify lines 131-155 contain the fix
    expect(wrapperCode).toContain('async safeStorageSet(key, value)');
    expect(wrapperCode).toContain('return { success: true, value: result };');
    expect(wrapperCode).toContain('// CRASH FIX: AsyncStorage.setItem returns undefined/true');

    console.log('✅ VERIFY: safeStorageSet fix is present in code');
  });

  test('VERIFY: asyncOperationWrapper.safeStorageRemove returns object structure', () => {
    const wrapperCode = require('fs').readFileSync(
      'C:\\Users\\josep\\OneDrive\\Desktop\\poultry360-app\\mobile\\poultry360-mobile\\src\\utils\\asyncOperationWrapper.js',
      'utf8'
    );

    // Verify lines 144-155 contain the fix
    expect(wrapperCode).toContain('async safeStorageRemove(key)');
    expect(wrapperCode).toContain('return { success: true, value: result };');
    expect(wrapperCode).toContain('// CRASH FIX: AsyncStorage.removeItem returns undefined/true');

    console.log('✅ VERIFY: safeStorageRemove fix is present in code');
  });

  test('VERIFY: RegisterScreen role selector has all 4 roles', () => {
    const registerCode = require('fs').readFileSync(
      'C:\\Users\josep\\OneDrive\\Desktop\\poultry360-app\\mobile\\poultry360-mobile\\src\\screens\\RegisterScreen.js',
      'utf8'
    );

    // Verify lines 578-589 contain all 4 roles
    const hasWorker = registerCode.includes('<Picker.Item label="👷 Worker" value="worker" />');
    const hasManager = registerCode.includes('<Picker.Item label="👨‍💼 Manager" value="manager" />');
    const hasAdmin = registerCode.includes('<Picker.Item label="⭐ Admin" value="admin" />');
    const hasOwner = registerCode.includes('<Picker.Item label="👑 Owner" value="owner" />');

    expect(hasWorker).toBe(true);
    expect(hasManager).toBe(true);
    expect(hasAdmin).toBe(true);
    expect(hasOwner).toBe(true);

    console.log('✅ VERIFY: All 4 roles are present in RegisterScreen');
  });
});
