import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  Dimensions,
  Platform,
} from 'react-native';
import { useTheme } from '../context/ThemeContext';
import { useLanguage, languages } from '../context/LanguageContext';
import CustomPicker from '../components/CustomPicker';

const { width, height } = Dimensions.get('window');

const WelcomeScreen = ({ navigation }) => {
  const { theme } = useTheme();
  const { t, changeLanguage, currentLanguage } = useLanguage();
  const [selectedLanguage, setSelectedLanguage] = useState(currentLanguage || 'en');
  const [navigating, setNavigating] = useState(false);

  useEffect(() => {
    setSelectedLanguage(currentLanguage);
  }, [currentLanguage]);

  const handleLanguageChange = (languageCode) => {
    try {
      setSelectedLanguage(languageCode);
      if (changeLanguage && typeof changeLanguage === 'function') {
        changeLanguage(languageCode);
      }
    } catch (error) {
      console.error('Language change error:', error);
    }
  };

  const handleLogin = () => {
    try {
      if (navigating) return;
      setNavigating(true);
      if (navigation?.navigate) {
        navigation.navigate('Login');
      }
    } catch (error) {
      console.error('Navigation to Login error:', error);
    } finally {
      setTimeout(() => setNavigating(false), 1000);
    }
  };

  const handleRegister = () => {
    try {
      if (navigating) return;
      setNavigating(true);
      if (navigation?.navigate) {
        navigation.navigate('Register');
      }
    } catch (error) {
      console.error('Navigation to Register error:', error);
    } finally {
      setTimeout(() => setNavigating(false), 1000);
    }
  };

  const handleDemoAccess = () => {
    try {
      if (navigating) return;
      setNavigating(true);
      if (navigation?.navigate) {
        navigation.navigate('Login', { prefilledEmail: 'demo@poultry360.com' });
      }
    } catch (error) {
      console.error('Navigation to Demo error:', error);
    } finally {
      setTimeout(() => setNavigating(false), 1000);
    }
  };

  return (
    <View style={[styles(theme).container, { backgroundColor: theme.colors.background }]}>
      <ScrollView
        contentContainerStyle={styles(theme).scrollContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Header with Logo */}
        <View style={styles(theme).headerContainer}>
          <View style={styles(theme).logoContainer}>
            <Text style={styles(theme).logoEmoji}>🐔</Text>
            <Text style={[styles(theme).appTitle, { color: theme.colors.primary }]}>
              Poultry360
            </Text>
            <Text style={[styles(theme).subtitle, { color: theme.colors.textSecondary }]}>
              {t('auth.farmManagement') || 'Poultry Farm Management System'}
            </Text>
          </View>
        </View>

        {/* Language Selection */}
        <View style={[styles(theme).languageContainer, {
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.shadowColor
        }]}>
          <Text style={[styles(theme).languageTitle, { color: theme.colors.text }]}>
            {t('settings.language') || 'Choose Language'} / Olulimi / Lugha
          </Text>
          <Text style={[styles(theme).languageSubtitle, { color: theme.colors.textSecondary }]}>
            {t('welcome.selectLanguage') || 'Select your preferred language to continue'}
          </Text>

          <CustomPicker
            selectedValue={selectedLanguage}
            onValueChange={handleLanguageChange}
            items={Object.entries(languages).map(([code, lang]) => ({
              label: `${lang.flag} ${lang.name} (${lang.nativeName})`,
              value: code
            }))}
          />
        </View>

        {/* Welcome Message */}
        <View style={[styles(theme).welcomeContainer, {
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.shadowColor
        }]}>
          <Text style={[styles(theme).welcomeTitle, { color: theme.colors.text }]}>
            {t('dashboard.welcome') || 'Welcome to Poultry360'}
          </Text>
          <Text style={[styles(theme).welcomeDescription, { color: theme.colors.textSecondary }]}>
            {t('welcome.description') || 'The complete solution for managing your poultry farm operations. Track production, monitor health, manage feed schedules, and analyze performance - all in one place.'}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles(theme).buttonContainer}>
          <TouchableOpacity
            style={[styles(theme).primaryButton, { backgroundColor: theme.colors.primary }, navigating && { opacity: 0.6 }]}
            onPress={handleLogin}
            activeOpacity={0.8}
            disabled={navigating}
          >
            <Text style={styles(theme).primaryButtonText}>
              {t('auth.login') || 'Sign In'}
            </Text>
            <Text style={styles(theme).buttonSubtext}>
              {t('welcome.existingAccount') || 'Already have an account?'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles(theme).secondaryButton, {
              backgroundColor: 'transparent',
              borderColor: theme.colors.primary,
              borderWidth: 2
            }, navigating && { opacity: 0.6 }]}
            onPress={handleRegister}
            activeOpacity={0.8}
            disabled={navigating}
          >
            <Text style={[styles(theme).secondaryButtonText, { color: theme.colors.primary }]}>
              {t('auth.register') || 'Create Account'}
            </Text>
            <Text style={[styles(theme).buttonSubtext, { color: theme.colors.textSecondary }]}>
              {t('welcome.newUser') || 'New to Poultry360?'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Features Preview */}
        <View style={[styles(theme).featuresContainer, {
          backgroundColor: theme.colors.surface,
          shadowColor: theme.colors.shadowColor
        }]}>
          <Text style={[styles(theme).featuresTitle, { color: theme.colors.text }]}>
            {t('welcome.features') || 'Key Features'}
          </Text>

          <View style={styles(theme).featuresGrid}>
            <View style={styles(theme).featureItem}>
              <Text style={styles(theme).featureIcon}>📊</Text>
              <Text style={[styles(theme).featureText, { color: theme.colors.textSecondary }]}>
                {t('navigation.dashboard') || 'Dashboard'}
              </Text>
            </View>

            <View style={styles(theme).featureItem}>
              <Text style={styles(theme).featureIcon}>🐔</Text>
              <Text style={[styles(theme).featureText, { color: theme.colors.textSecondary }]}>
                {t('navigation.flocks') || 'Flock Management'}
              </Text>
            </View>

            <View style={styles(theme).featureItem}>
              <Text style={styles(theme).featureIcon}>📝</Text>
              <Text style={[styles(theme).featureText, { color: theme.colors.textSecondary }]}>
                {t('navigation.production') || 'Production Records'}
              </Text>
            </View>

            <View style={styles(theme).featureItem}>
              <Text style={styles(theme).featureIcon}>💊</Text>
              <Text style={[styles(theme).featureText, { color: theme.colors.textSecondary }]}>
                {t('navigation.health') || 'Health Monitoring'}
              </Text>
            </View>
          </View>
        </View>

        {/* Demo Access */}
        <View style={[styles(theme).demoContainer, {
          backgroundColor: theme.colors.demoBackground || '#f8f9fa',
          borderColor: theme.colors.demoBorder || '#dee2e6'
        }]}>
          <Text style={[styles(theme).demoTitle, { color: theme.colors.demoText || '#6c757d' }]}>
            {t('welcome.tryDemo') || 'Try Demo Mode'}
          </Text>
          <Text style={[styles(theme).demoSubtitle, { color: theme.colors.demoText || '#6c757d' }]}>
            {t('welcome.demoDescription') || 'Explore the app with sample data - no registration required'}
          </Text>

          <TouchableOpacity
            style={[styles(theme).demoButton, { backgroundColor: '#28a745' }, navigating && { opacity: 0.6 }]}
            onPress={handleDemoAccess}
            activeOpacity={0.8}
            disabled={navigating}
          >
            <Text style={styles(theme).demoButtonText}>
              {t('welcome.demoAccess') || '🚀 Quick Demo Access'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Footer */}
        <View style={styles(theme).footer}>
          <Text style={[styles(theme).footerText, { color: theme.colors.textSecondary }]}>
            {t('welcome.poweredBy') || 'Powered by Poultry360'} © 2024
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 50 : 30,
    paddingBottom: 30,
  },
  headerContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoContainer: {
    alignItems: 'center',
  },
  logoEmoji: {
    fontSize: 80,
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 36,
    fontWeight: 'bold',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
    marginBottom: 10,
  },
  languageContainer: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  languageTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  languageSubtitle: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 15,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 10,
    overflow: 'hidden',
  },
  picker: {
    height: 50,
    width: '100%',
  },
  welcomeContainer: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 25,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  welcomeTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 12,
  },
  welcomeDescription: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  buttonContainer: {
    marginBottom: 25,
    gap: 15,
  },
  primaryButton: {
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
  },
  primaryButtonText: {
    color: theme.colors.buttonText,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  secondaryButton: {
    paddingVertical: 18,
    paddingHorizontal: 30,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 70,
  },
  secondaryButtonText: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  buttonSubtext: {
    fontSize: 12,
    opacity: 0.8,
  },
  featuresContainer: {
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  featuresTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 15,
  },
  featuresGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  featureItem: {
    width: '48%',
    alignItems: 'center',
    marginBottom: 15,
  },
  featureIcon: {
    fontSize: 32,
    marginBottom: 5,
  },
  featureText: {
    fontSize: 12,
    textAlign: 'center',
    fontWeight: '500',
  },
  demoContainer: {
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    borderWidth: 1,
  },
  demoTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 5,
  },
  demoSubtitle: {
    fontSize: 12,
    textAlign: 'center',
    marginBottom: 15,
    opacity: 0.8,
  },
  demoButton: {
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  demoButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  footer: {
    alignItems: 'center',
    paddingTop: 20,
  },
  footerText: {
    fontSize: 12,
    textAlign: 'center',
  },
});

export default WelcomeScreen;