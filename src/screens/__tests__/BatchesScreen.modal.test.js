/**
 * BatchesScreen Modal Opening Test Suite
 *
 * Tests the complete flow of button clicks opening the modal
 *
 * OBJECTIVE: Identify why modal doesn't open when buttons are clicked
 */

import React from 'react';
import { render, fireEvent, waitFor, act } from '@testing-library/react-native';
import { Alert } from 'react-native';
import BatchesScreen from '../BatchesScreen';
import fastApiService from '../../services/fastApiService';
import { DataStoreProvider } from '../../context/DataStoreContext';

// Mock dependencies
jest.mock('../../services/fastApiService');
jest.mock('../../context/AuthContext', () => ({
  useAuth: () => ({
    user: {
      id: 1,
      role: 'manager',
      email: 'manager@test.com',
      organizationId: 1
    }
  })
}));

jest.mock('../../context/ThemeContext', () => ({
  useTheme: () => ({
    theme: {
      colors: {
        background: '#fff',
        surface: '#fff',
        text: '#000',
        textSecondary: '#666',
        textLight: '#999',
        primary: '#2E8B57',
        secondary: '#4ECDC4',
        cardBackground: '#fff',
        shadowColor: '#000',
        border: '#ddd',
        borderSecondary: '#ccc',
        overlay: 'rgba(0,0,0,0.5)',
        inputBackground: '#f5f5f5',
        inputBorder: '#ddd',
        inputText: '#000',
        placeholder: '#999'
      }
    }
  })
}));

jest.mock('../../context/OfflineContext', () => ({
  useOffline: () => ({
    isConnected: true
  })
}));

jest.mock('../../context/DashboardRefreshContext', () => ({
  useDashboardRefresh: () => ({
    triggerDashboardRefresh: jest.fn(),
    refreshTrigger: 0
  })
}));

jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({
    navigate: jest.fn(),
    setParams: jest.fn()
  })
}));

// Mock Alert
jest.spyOn(Alert, 'alert');

// Helper function to wrap components with necessary providers
const renderWithProviders = (component) => {
  return render(
    <DataStoreProvider>
      {component}
    </DataStoreProvider>
  );
};

describe('BatchesScreen Modal Opening Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default mock responses
    fastApiService.init.mockResolvedValue(true);
    fastApiService.getFlocks.mockResolvedValue({
      success: true,
      data: []
    });
    fastApiService.getFarms.mockResolvedValue({
      success: true,
      data: [
        { id: 1, farmName: 'Test Farm 1', location: 'Location 1' },
        { id: 2, farmName: 'Test Farm 2', location: 'Location 2' }
      ]
    });
  });

  describe('TEST 1: TouchableOpacity onPress Handler Binding', () => {
    test('1.1 - Add Batch button should have onPress handler', async () => {
      const { getByText } = renderWithProviders(
        <BatchesScreen route={{ params: {} }} navigation={{ navigate: jest.fn(), setParams: jest.fn() }} />
      );

      await waitFor(() => {
        expect(getByText('+ Add Batch')).toBeTruthy();
      }, { timeout: 3000 });

      const addButton = getByText('+ Add Batch');
      expect(addButton).toBeDefined();

      // Get the TouchableOpacity parent
      const touchable = addButton.parent;
      expect(touchable.props.onPress).toBeDefined();
      expect(typeof touchable.props.onPress).toBe('function');

      console.log('✅ TEST 1.1 PASSED: onPress handler is properly bound');
    });

    test('1.2 - Create First Batch button should have onPress handler (empty state)', async () => {
      // Mock empty batches
      fastApiService.getFlocks.mockResolvedValue({
        success: true,
        data: []
      });

      const { getByText } = renderWithProviders(
        <BatchesScreen route={{ params: {} }} navigation={{ navigate: jest.fn(), setParams: jest.fn() }} />
      );

      await waitFor(() => {
        expect(getByText('Create First Batch')).toBeTruthy();
      }, { timeout: 3000 });

      const createButton = getByText('Create First Batch');
      expect(createButton).toBeDefined();

      const touchable = createButton.parent;
      expect(touchable.props.onPress).toBeDefined();
      expect(typeof touchable.props.onPress).toBe('function');

      console.log('✅ TEST 1.2 PASSED: Empty state button has onPress handler');
    });
  });

  describe('TEST 2: openModal Function Execution', () => {
    test('2.1 - openModal should be called when Add Batch is clicked', async () => {
      const { getByText } = renderWithProviders(
        <BatchesScreen route={{ params: {} }} navigation={{ navigate: jest.fn(), setParams: jest.fn() }} />
      );

      await waitFor(() => {
        expect(getByText('+ Add Batch')).toBeTruthy();
      }, { timeout: 3000 });

      const consoleLogSpy = jest.spyOn(console, 'log');

      const addButton = getByText('+ Add Batch');

      await act(async () => {
        fireEvent.press(addButton);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Check if openModal console log was called
      const openModalCalled = consoleLogSpy.mock.calls.some(
        call => call[0] && call[0].includes('BUTTON PRESSED: openModal called')
      );

      expect(openModalCalled).toBe(true);
      console.log('✅ TEST 2.1 PASSED: openModal function executed');

      consoleLogSpy.mockRestore();
    });

    test('2.2 - openModal should check user permissions', async () => {
      const { getByText } = renderWithProviders(
        <BatchesScreen route={{ params: {} }} navigation={{ navigate: jest.fn(), setParams: jest.fn() }} />
      );

      await waitFor(() => {
        expect(getByText('+ Add Batch')).toBeTruthy();
      }, { timeout: 3000 });

      const consoleLogSpy = jest.spyOn(console, 'log');

      const addButton = getByText('+ Add Batch');

      await act(async () => {
        fireEvent.press(addButton);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Check if permission check passed
      const accessDenied = consoleLogSpy.mock.calls.some(
        call => call[0] && call[0].includes('Access denied')
      );

      expect(accessDenied).toBe(false); // Should NOT be denied for manager role
      console.log('✅ TEST 2.2 PASSED: User permission check passed');

      consoleLogSpy.mockRestore();
    });
  });

  describe('TEST 3: setModalVisible(true) Execution', () => {
    test('3.1 - Modal visibility state should change to true', async () => {
      const { getByText, queryByText } = renderWithProviders(
        <BatchesScreen route={{ params: {} }} navigation={{ navigate: jest.fn(), setParams: jest.fn() }} />
      );

      await waitFor(() => {
        expect(getByText('+ Add Batch')).toBeTruthy();
      }, { timeout: 3000 });

      const addButton = getByText('+ Add Batch');

      await act(async () => {
        fireEvent.press(addButton);
        // Wait for async operations in openModal
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      // Modal should show the title
      await waitFor(() => {
        const modalTitle = queryByText('Add New Batch');
        expect(modalTitle).toBeTruthy();
      }, { timeout: 2000 });

      console.log('✅ TEST 3.1 PASSED: Modal visibility changed to true');
    });
  });

  describe('TEST 4: Modal Component Visibility', () => {
    test('4.1 - Modal should render with correct title', async () => {
      const { getByText } = renderWithProviders(
        <BatchesScreen route={{ params: {} }} navigation={{ navigate: jest.fn(), setParams: jest.fn() }} />
      );

      await waitFor(() => {
        expect(getByText('+ Add Batch')).toBeTruthy();
      }, { timeout: 3000 });

      const addButton = getByText('+ Add Batch');

      await act(async () => {
        fireEvent.press(addButton);
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      await waitFor(() => {
        expect(getByText('Add New Batch')).toBeTruthy();
      }, { timeout: 2000 });

      console.log('✅ TEST 4.1 PASSED: Modal renders with title');
    });

    test('4.2 - Modal should display form fields', async () => {
      const { getByText, getByPlaceholderText } = renderWithProviders(
        <BatchesScreen route={{ params: {} }} navigation={{ navigate: jest.fn(), setParams: jest.fn() }} />
      );

      await waitFor(() => {
        expect(getByText('+ Add Batch')).toBeTruthy();
      }, { timeout: 3000 });

      const addButton = getByText('+ Add Batch');

      await act(async () => {
        fireEvent.press(addButton);
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      await waitFor(() => {
        expect(getByPlaceholderText('Enter batch name')).toBeTruthy();
        expect(getByPlaceholderText('Enter bird type (e.g., Broiler, Layer)')).toBeTruthy();
        expect(getByPlaceholderText('Number of birds')).toBeTruthy();
      }, { timeout: 2000 });

      console.log('✅ TEST 4.2 PASSED: Modal displays all form fields');
    });
  });

  describe('TEST 5: Farm Availability Check', () => {
    test('5.1 - Modal should open when farms are available', async () => {
      const { getByText } = renderWithProviders(
        <BatchesScreen route={{ params: {} }} navigation={{ navigate: jest.fn(), setParams: jest.fn() }} />
      );

      await waitFor(() => {
        expect(getByText('+ Add Batch')).toBeTruthy();
      }, { timeout: 3000 });

      const consoleLogSpy = jest.spyOn(console, 'log');

      const addButton = getByText('+ Add Batch');

      await act(async () => {
        fireEvent.press(addButton);
        await new Promise(resolve => setTimeout(resolve, 1000));
      });

      // Check if modal opened
      const modalOpened = consoleLogSpy.mock.calls.some(
        call => call[0] && call[0].includes('Setting modalVisible to TRUE')
      );

      expect(modalOpened).toBe(true);
      console.log('✅ TEST 5.1 PASSED: Modal opens when farms available');

      consoleLogSpy.mockRestore();
    });

    test('5.2 - Alert should show when no farms available', async () => {
      // Mock no farms
      fastApiService.getFarms.mockResolvedValue({
        success: true,
        data: []
      });

      Alert.alert.mockClear();

      const { getByText } = renderWithProviders(
        <BatchesScreen route={{ params: {} }} navigation={{ navigate: jest.fn(), setParams: jest.fn() }} />
      );

      await waitFor(() => {
        expect(getByText('+ Add Batch')).toBeTruthy();
      }, { timeout: 3000 });

      const addButton = getByText('+ Add Batch');

      await act(async () => {
        fireEvent.press(addButton);
        await new Promise(resolve => setTimeout(resolve, 1500));
      });

      // Check if alert was shown
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalledWith(
          'No Farms Available',
          expect.stringContaining('Please create a farm first'),
          expect.any(Array)
        );
      }, { timeout: 2000 });

      console.log('✅ TEST 5.2 PASSED: Alert shown when no farms');
    });
  });

  describe('TEST 6: User Permission Check', () => {
    test('6.1 - Worker role should be denied access', async () => {
      // Override mock for worker role
      jest.doMock('../../context/AuthContext', () => ({
        useAuth: () => ({
          user: {
            id: 2,
            role: 'worker',
            email: 'worker@test.com',
            organizationId: 1
          }
        })
      }));

      // Re-import component with new mock
      const BatchesScreenWorker = require('../BatchesScreen').default;

      Alert.alert.mockClear();

      const { getByText } = renderWithProviders(
        <BatchesScreenWorker route={{ params: {} }} navigation={{ navigate: jest.fn(), setParams: jest.fn() }} />
      );

      await waitFor(() => {
        expect(getByText('+ Add Batch')).toBeTruthy();
      }, { timeout: 3000 });

      const addButton = getByText('+ Add Batch');

      await act(async () => {
        fireEvent.press(addButton);
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      // Check if access denied alert was shown
      expect(Alert.alert).toHaveBeenCalledWith(
        'Access Denied',
        expect.stringContaining('Only managers can create or edit batches')
      );

      console.log('✅ TEST 6.1 PASSED: Worker role properly denied');
    });
  });

  describe('TEST 7: Async/Await Flow', () => {
    test('7.1 - Modal should not hang during farm loading', async () => {
      // Add delay to farm loading
      fastApiService.getFarms.mockImplementation(() =>
        new Promise(resolve =>
          setTimeout(() => resolve({
            success: true,
            data: [{ id: 1, farmName: 'Test Farm', location: 'Test Location' }]
          }), 500)
        )
      );

      const { getByText } = renderWithProviders(
        <BatchesScreen route={{ params: {} }} navigation={{ navigate: jest.fn(), setParams: jest.fn() }} />
      );

      await waitFor(() => {
        expect(getByText('+ Add Batch')).toBeTruthy();
      }, { timeout: 3000 });

      const startTime = Date.now();

      const addButton = getByText('+ Add Batch');

      await act(async () => {
        fireEvent.press(addButton);
        await new Promise(resolve => setTimeout(resolve, 2000));
      });

      const endTime = Date.now();
      const duration = endTime - startTime;

      // Modal should open within reasonable time (< 2500ms)
      expect(duration).toBeLessThan(2500);

      await waitFor(() => {
        expect(getByText('Add New Batch')).toBeTruthy();
      }, { timeout: 1000 });

      console.log(`✅ TEST 7.1 PASSED: Modal opened in ${duration}ms`);
    });

    test('7.2 - Modal should handle farm loading errors gracefully', async () => {
      // Mock farm loading error
      fastApiService.getFarms.mockRejectedValue(new Error('Network error'));

      Alert.alert.mockClear();

      const { getByText } = renderWithProviders(
        <BatchesScreen route={{ params: {} }} navigation={{ navigate: jest.fn(), setParams: jest.fn() }} />
      );

      await waitFor(() => {
        expect(getByText('+ Add Batch')).toBeTruthy();
      }, { timeout: 3000 });

      const addButton = getByText('+ Add Batch');

      await act(async () => {
        fireEvent.press(addButton);
        await new Promise(resolve => setTimeout(resolve, 2000));
      });

      // Should show alert about no farms
      await waitFor(() => {
        expect(Alert.alert).toHaveBeenCalled();
      }, { timeout: 2000 });

      console.log('✅ TEST 7.2 PASSED: Errors handled gracefully');
    });
  });

  describe('TEST 8: Complete Flow Integration', () => {
    test('8.1 - Complete flow: Button Click → Modal Open → Form Display', async () => {
      const { getByText, getByPlaceholderText } = renderWithProviders(
        <BatchesScreen route={{ params: {} }} navigation={{ navigate: jest.fn(), setParams: jest.fn() }} />
      );

      console.log('🔵 Step 1: Wait for screen to load');
      await waitFor(() => {
        expect(getByText('+ Add Batch')).toBeTruthy();
      }, { timeout: 3000 });

      console.log('🔵 Step 2: Click Add Batch button');
      const addButton = getByText('+ Add Batch');

      await act(async () => {
        fireEvent.press(addButton);
        console.log('🔵 Step 3: Wait for modal to process');
        await new Promise(resolve => setTimeout(resolve, 1500));
      });

      console.log('🔵 Step 4: Check modal is visible');
      await waitFor(() => {
        expect(getByText('Add New Batch')).toBeTruthy();
      }, { timeout: 2000 });

      console.log('🔵 Step 5: Verify form fields are visible');
      expect(getByPlaceholderText('Enter batch name')).toBeTruthy();
      expect(getByPlaceholderText('Enter bird type (e.g., Broiler, Layer)')).toBeTruthy();
      expect(getByPlaceholderText('Number of birds')).toBeTruthy();
      expect(getByText('Cancel')).toBeTruthy();
      expect(getByText('Create')).toBeTruthy();

      console.log('✅ TEST 8.1 PASSED: Complete flow works end-to-end');
    });
  });
});
