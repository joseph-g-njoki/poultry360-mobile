import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Import translation files
import enTranslations from '../locales/en.json';
import lgTranslations from '../locales/lg.json';
import swTranslations from '../locales/sw.json';

const LanguageContext = createContext();

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};

export const languages = {
  en: {
    code: 'en',
    name: 'English',
    flag: '🇺🇸',
    nativeName: 'English',
  },
  lg: {
    code: 'lg',
    name: 'Luganda',
    flag: '🇺🇬',
    nativeName: 'Oluganda',
  },
  sw: {
    code: 'sw',
    name: 'Swahili',
    flag: '🇹🇿',
    nativeName: 'Kiswahili',
  },
};

export const translations = {
  en: enTranslations,
  lg: lgTranslations,
  sw: swTranslations,
};

export const LanguageProvider = ({ children }) => {
  const [currentLanguage, setCurrentLanguage] = useState('en');
  const [isLoading, setIsLoading] = useState(true);

  // Load language preference from AsyncStorage on app start
  useEffect(() => {
    loadLanguagePreference();
  }, []);

  const loadLanguagePreference = async () => {
    try {
      const savedLanguage = await AsyncStorage.getItem('@language_preference');
      if (savedLanguage !== null && languages[savedLanguage]) {
        setCurrentLanguage(savedLanguage);
      }
    } catch (error) {
      console.error('Error loading language preference:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const changeLanguage = useCallback(async (languageCode) => {
    try {
      if (languages[languageCode]) {
        setCurrentLanguage(languageCode);
        await AsyncStorage.setItem('@language_preference', languageCode);
      }
    } catch (error) {
      console.error('Error saving language preference:', error);
    }
  }, []);

  const t = useCallback((key) => {
    // Support nested keys like 'common.save' or 'auth.login'
    const getNestedValue = (obj, path) => {
      return path.split('.').reduce((current, key) => current?.[key], obj);
    };

    const currentTranslation = getNestedValue(translations[currentLanguage], key);
    const fallbackTranslation = getNestedValue(translations.en, key);

    return currentTranslation || fallbackTranslation || key;
  }, [currentLanguage]);

  const getCurrentLanguageInfo = useCallback(() => {
    return languages[currentLanguage];
  }, [currentLanguage]);

  const value = useMemo(() => ({
    currentLanguage,
    changeLanguage,
    t,
    languages,
    getCurrentLanguageInfo,
    isLoading,
  }), [currentLanguage, isLoading]);

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  );
};