import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

export const lightTheme = {
  colors: {
    primary: '#2E8B57',
    secondary: '#FF6B35',
    background: '#f8f9fa',
    surface: '#ffffff',
    text: '#333333',
    textSecondary: '#666666',
    textLight: '#999999',
    border: '#f0f0f0',
    borderSecondary: '#ddd',
    success: '#28a745',
    warning: '#ffc107',
    error: '#dc3545',
    info: '#17a2b8',
    overlay: 'rgba(0, 0, 0, 0.5)',
    shadowColor: '#000',
    headerBackground: '#2E8B57',
    headerText: '#ffffff',
    cardBackground: '#ffffff',
    inputBackground: '#f9f9f9',
    inputBorder: '#ddd',
    inputText: '#333333',
    placeholder: '#999999',
    tabBarBackground: '#ffffff',
    tabBarBorder: '#e1e1e1',
    tabBarActiveTint: '#2E8B57',
    tabBarInactiveTint: '#999999',
    loadingBackground: '#ffffff',
    loadingText: '#2E8B57',
    demoBackground: '#e8f5e8',
    demoBorder: '#2E8B57',
    demoText: '#2E8B57',
  },
  name: 'light',
};

export const darkTheme = {
  colors: {
    primary: '#4CAF50',
    secondary: '#FF7F50',
    background: '#121212',
    surface: '#1e1e1e',
    text: '#ffffff',
    textSecondary: '#cccccc',
    textLight: '#999999',
    border: '#333333',
    borderSecondary: '#444444',
    success: '#4caf50',
    warning: '#ff9800',
    error: '#f44336',
    info: '#2196f3',
    overlay: 'rgba(0, 0, 0, 0.7)',
    shadowColor: '#000',
    headerBackground: '#1e1e1e',
    headerText: '#ffffff',
    cardBackground: '#2a2a2a',
    inputBackground: '#2a2a2a',
    inputBorder: '#444444',
    inputText: '#ffffff',
    placeholder: '#999999',
    tabBarBackground: '#1e1e1e',
    tabBarBorder: '#333333',
    tabBarActiveTint: '#4CAF50',
    tabBarInactiveTint: '#999999',
    loadingBackground: '#121212',
    loadingText: '#4CAF50',
    demoBackground: '#1a4d1a',
    demoBorder: '#4CAF50',
    demoText: '#4CAF50',
  },
  name: 'dark',
};

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(lightTheme);
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Load theme preference from AsyncStorage on app start
  useEffect(() => {
    loadThemePreference();
  }, []);

  const loadThemePreference = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('@theme_preference');
      if (savedTheme !== null) {
        const isDark = savedTheme === 'dark';
        setIsDarkMode(isDark);
        setTheme(isDark ? darkTheme : lightTheme);
      }
    } catch (error) {
      console.error('Error loading theme preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const toggleTheme = useCallback(async () => {
    try {
      const newIsDarkMode = !isDarkMode;
      const newTheme = newIsDarkMode ? darkTheme : lightTheme;

      setIsDarkMode(newIsDarkMode);
      setTheme(newTheme);

      // Save preference to AsyncStorage
      await AsyncStorage.setItem('@theme_preference', newIsDarkMode ? 'dark' : 'light');
    } catch (error) {
      console.error('Error saving theme preference:', error);
    }
  }, [isDarkMode]);

  const value = useMemo(() => ({
    theme,
    isDarkMode,
    toggleTheme,
    isLoading,
  }), [theme, isDarkMode, isLoading]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};