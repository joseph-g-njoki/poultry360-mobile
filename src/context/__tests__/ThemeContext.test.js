import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { ThemeProvider, useTheme, lightTheme, darkTheme } from '../ThemeContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

describe('ThemeContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();
  });

  describe('Initial State', () => {
    it('should provide light theme by default', async () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.theme).toEqual(lightTheme);
      expect(result.current.isDarkMode).toBe(false);
    });

    it('should throw error when useTheme is used outside provider', () => {
      const consoleError = console.error;
      console.error = jest.fn();

      expect(() => {
        renderHook(() => useTheme());
      }).toThrow('useTheme must be used within a ThemeProvider');

      console.error = consoleError;
    });
  });

  describe('Theme Persistence', () => {
    it('should load dark theme from storage on initialization', async () => {
      await AsyncStorage.setItem('@theme_preference', 'dark');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isDarkMode).toBe(true);
      expect(result.current.theme).toEqual(darkTheme);
    });

    it('should load light theme from storage on initialization', async () => {
      await AsyncStorage.setItem('@theme_preference', 'light');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isDarkMode).toBe(false);
      expect(result.current.theme).toEqual(lightTheme);
    });

    it('should handle missing storage data gracefully', async () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isDarkMode).toBe(false);
      expect(result.current.theme).toEqual(lightTheme);
    });
  });

  describe('Theme Toggle', () => {
    it('should toggle from light to dark theme', async () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isDarkMode).toBe(false);

      await act(async () => {
        await result.current.toggleTheme();
      });

      expect(result.current.isDarkMode).toBe(true);
      expect(result.current.theme).toEqual(darkTheme);

      const savedTheme = await AsyncStorage.getItem('@theme_preference');
      expect(savedTheme).toBe('dark');
    });

    it('should toggle from dark to light theme', async () => {
      await AsyncStorage.setItem('@theme_preference', 'dark');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.isDarkMode).toBe(true);

      await act(async () => {
        await result.current.toggleTheme();
      });

      expect(result.current.isDarkMode).toBe(false);
      expect(result.current.theme).toEqual(lightTheme);

      const savedTheme = await AsyncStorage.getItem('@theme_preference');
      expect(savedTheme).toBe('light');
    });

    it('should toggle theme multiple times', async () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Light -> Dark
      await act(async () => {
        await result.current.toggleTheme();
      });
      expect(result.current.isDarkMode).toBe(true);

      // Dark -> Light
      await act(async () => {
        await result.current.toggleTheme();
      });
      expect(result.current.isDarkMode).toBe(false);

      // Light -> Dark
      await act(async () => {
        await result.current.toggleTheme();
      });
      expect(result.current.isDarkMode).toBe(true);
    });
  });

  describe('Theme Colors', () => {
    it('should provide correct light theme colors', async () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const { colors } = result.current.theme;

      expect(colors.primary).toBe('#2E8B57');
      expect(colors.background).toBe('#f8f9fa');
      expect(colors.text).toBe('#333333');
      expect(colors.surface).toBe('#ffffff');
      expect(colors.error).toBe('#dc3545');
    });

    it('should provide correct dark theme colors', async () => {
      await AsyncStorage.setItem('@theme_preference', 'dark');

      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const { colors } = result.current.theme;

      expect(colors.primary).toBe('#4CAF50');
      expect(colors.background).toBe('#121212');
      expect(colors.text).toBe('#ffffff');
      expect(colors.surface).toBe('#1e1e1e');
      expect(colors.error).toBe('#f44336');
    });
  });

  describe('Error Handling', () => {
    it('should handle storage read errors gracefully', async () => {
      AsyncStorage.getItem = jest.fn().mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should default to light theme on error
      expect(result.current.isDarkMode).toBe(false);
      expect(result.current.theme).toEqual(lightTheme);
    });

    it('should handle storage write errors gracefully during toggle', async () => {
      const { result } = renderHook(() => useTheme(), {
        wrapper: ThemeProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      AsyncStorage.setItem = jest.fn().mockRejectedValue(new Error('Storage error'));

      // Should still update theme in memory even if storage fails
      await act(async () => {
        await result.current.toggleTheme();
      });

      expect(result.current.isDarkMode).toBe(true);
      expect(result.current.theme).toEqual(darkTheme);
    });
  });

  describe('Theme Object Structure', () => {
    it('should have consistent theme structure for light and dark themes', () => {
      const lightKeys = Object.keys(lightTheme.colors);
      const darkKeys = Object.keys(darkTheme.colors);

      expect(lightKeys.sort()).toEqual(darkKeys.sort());
    });

    it('should have name property for both themes', () => {
      expect(lightTheme.name).toBe('light');
      expect(darkTheme.name).toBe('dark');
    });
  });
});