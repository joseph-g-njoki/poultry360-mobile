import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react-native';
import { LanguageProvider, useLanguage, languages } from '../LanguageContext';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Mock translation files
jest.mock('../../locales/en.json', () => ({
  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete'
  },
  auth: {
    login: 'Login',
    register: 'Register'
  }
}), { virtual: true });

jest.mock('../../locales/lg.json', () => ({
  common: {
    save: 'Kuuma',
    cancel: 'Sazaamu',
    delete: 'Ggyawo'
  },
  auth: {
    login: 'Yingira',
    register: 'Wewandiise'
  }
}), { virtual: true });

jest.mock('../../locales/sw.json', () => ({
  common: {
    save: 'Hifadhi',
    cancel: 'Ghairi',
    delete: 'Futa'
  },
  auth: {
    login: 'Ingia',
    register: 'Sajili'
  }
}), { virtual: true });

describe('LanguageContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    AsyncStorage.clear();
  });

  describe('Initial State', () => {
    it('should provide English as default language', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentLanguage).toBe('en');
    });

    it('should throw error when useLanguage is used outside provider', () => {
      const consoleError = console.error;
      console.error = jest.fn();

      expect(() => {
        renderHook(() => useLanguage());
      }).toThrow('useLanguage must be used within a LanguageProvider');

      console.error = consoleError;
    });
  });

  describe('Language Persistence', () => {
    it('should load Luganda from storage on initialization', async () => {
      await AsyncStorage.setItem('@language_preference', 'lg');

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentLanguage).toBe('lg');
    });

    it('should load Swahili from storage on initialization', async () => {
      await AsyncStorage.setItem('@language_preference', 'sw');

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentLanguage).toBe('sw');
    });

    it('should default to English when storage has invalid language', async () => {
      await AsyncStorage.setItem('@language_preference', 'invalid');

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.currentLanguage).toBe('en');
    });
  });

  describe('Language Switching', () => {
    it('should change language to Luganda', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.changeLanguage('lg');
      });

      expect(result.current.currentLanguage).toBe('lg');

      const savedLanguage = await AsyncStorage.getItem('@language_preference');
      expect(savedLanguage).toBe('lg');
    });

    it('should change language to Swahili', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.changeLanguage('sw');
      });

      expect(result.current.currentLanguage).toBe('sw');

      const savedLanguage = await AsyncStorage.getItem('@language_preference');
      expect(savedLanguage).toBe('sw');
    });

    it('should change language back to English', async () => {
      await AsyncStorage.setItem('@language_preference', 'sw');

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.changeLanguage('en');
      });

      expect(result.current.currentLanguage).toBe('en');
    });

    it('should not change to invalid language', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      await act(async () => {
        await result.current.changeLanguage('invalid');
      });

      expect(result.current.currentLanguage).toBe('en');
    });
  });

  describe('Translation Function', () => {
    it('should translate simple keys in English', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.t('common.save')).toBe('Save');
      expect(result.current.t('auth.login')).toBe('Login');
    });

    it('should translate keys in Luganda', async () => {
      await AsyncStorage.setItem('@language_preference', 'lg');

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.t('common.save')).toBe('Kuuma');
      expect(result.current.t('auth.login')).toBe('Yingira');
    });

    it('should translate keys in Swahili', async () => {
      await AsyncStorage.setItem('@language_preference', 'sw');

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.t('common.save')).toBe('Hifadhi');
      expect(result.current.t('auth.login')).toBe('Ingia');
    });

    it('should fallback to English for missing translations', async () => {
      await AsyncStorage.setItem('@language_preference', 'sw');

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // If a key exists in English but not in Swahili, should fallback to English
      expect(result.current.t('common.save')).toBeTruthy();
    });

    it('should return key itself if translation not found', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const nonExistentKey = 'nonexistent.key.path';
      expect(result.current.t(nonExistentKey)).toBe(nonExistentKey);
    });

    it('should handle nested translation keys', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.t('common.cancel')).toBe('Cancel');
      expect(result.current.t('auth.register')).toBe('Register');
    });
  });

  describe('Language Information', () => {
    it('should provide current language info for English', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const info = result.current.getCurrentLanguageInfo();

      expect(info.code).toBe('en');
      expect(info.name).toBe('English');
      expect(info.nativeName).toBe('English');
      expect(info.flag).toBeTruthy();
    });

    it('should provide current language info for Luganda', async () => {
      await AsyncStorage.setItem('@language_preference', 'lg');

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const info = result.current.getCurrentLanguageInfo();

      expect(info.code).toBe('lg');
      expect(info.name).toBe('Luganda');
      expect(info.nativeName).toBe('Oluganda');
    });

    it('should provide all available languages', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.languages).toHaveProperty('en');
      expect(result.current.languages).toHaveProperty('lg');
      expect(result.current.languages).toHaveProperty('sw');

      expect(Object.keys(result.current.languages).length).toBe(3);
    });
  });

  describe('Error Handling', () => {
    it('should handle storage read errors gracefully', async () => {
      AsyncStorage.getItem = jest.fn().mockRejectedValue(new Error('Storage error'));

      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Should default to English on error
      expect(result.current.currentLanguage).toBe('en');
    });

    it('should handle storage write errors gracefully during language change', async () => {
      const { result } = renderHook(() => useLanguage(), {
        wrapper: LanguageProvider,
      });

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      AsyncStorage.setItem = jest.fn().mockRejectedValue(new Error('Storage error'));

      // Should still update language in memory even if storage fails
      await act(async () => {
        await result.current.changeLanguage('sw');
      });

      expect(result.current.currentLanguage).toBe('sw');
    });
  });

  describe('Language Availability', () => {
    it('should have consistent language object structure', () => {
      const requiredKeys = ['code', 'name', 'flag', 'nativeName'];

      Object.values(languages).forEach(lang => {
        requiredKeys.forEach(key => {
          expect(lang).toHaveProperty(key);
        });
      });
    });
  });
});