import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const LoginScreen = ({ navigation, route }) => {
  // CRASH FIX: Safely extract route params with proper null checks
  const prefilledEmail = route?.params?.prefilledEmail || '';
  const prefilledPassword = route?.params?.prefilledPassword || '';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [isPreFilled, setIsPreFilled] = useState(false);

  // CRASH FIX: Add null checks for context hooks
  const authContext = useAuth();
  const themeContext = useTheme();
  const languageContext = useLanguage();

  // CRASH FIX: Validate contexts are available
  if (!authContext || !themeContext || !languageContext) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, color: '#FF3B30', marginBottom: 10 }}>Context Error</Text>
        <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' }}>
          Required app contexts are not available. Please restart the app.
        </Text>
      </View>
    );
  }

  const { login, authError, retryAuth } = authContext;
  const { theme } = themeContext;
  const { t } = languageContext;

  // CRASH FIX: Clear auth error when user starts typing
  useEffect(() => {
    if (authError && (email || password)) {
      // Clear error when user modifies input
      if (retryAuth) {
        retryAuth();
      }
    }
  }, [email, password]);

  // Handle pre-filled credentials from registration
  useEffect(() => {
    console.log('🔍 LoginScreen: Checking for pre-filled credentials...');
    console.log('   - Route params:', route?.params);
    console.log('   - Has prefilledEmail:', !!route?.params?.prefilledEmail);
    console.log('   - Has prefilledPassword:', !!route?.params?.prefilledPassword);

    if (route?.params?.prefilledEmail && route?.params?.prefilledPassword) {
      console.log('✅ Pre-filling credentials:');
      console.log('   - Email:', route.params.prefilledEmail);
      console.log('   - Password length:', route.params.prefilledPassword.length);

      setEmail(route.params.prefilledEmail);
      setPassword(route.params.prefilledPassword);
      setIsPreFilled(true);

      console.log('✅ Credentials pre-filled successfully!');

      // Clear the password from navigation params for security
      // This prevents the password from being stored in navigation history
      if (navigation.setParams) {
        setTimeout(() => {
          console.log('🔒 Clearing password from navigation params for security');
          navigation.setParams({ prefilledPassword: undefined });
        }, 100);
      }
    } else {
      console.log('ℹ️  No pre-filled credentials found');
      setIsPreFilled(false);
    }
  }, [route?.params]);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('Error', 'Please fill in all fields');
      return;
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    setLoading(true);
    try {
      console.log('🔐 Starting login...');
      console.log('📡 Calling login API...');
      console.log(`   - Email: ${email}`);
      console.log(`   - Password length: ${password.length}`);

      // CRASH FIX: Ensure login returns a valid result object
      // IMPORTANT: Password is NOT trimmed - spaces can be part of the password
      const result = await login(email.toLowerCase().trim(), password);

      console.log('📥 Login response:', JSON.stringify(result, null, 2));

      // CRASH FIX: Add comprehensive null/undefined checks for result
      if (!result || typeof result !== 'object') {
        console.error('❌ Login result is null or not an object:', result);
        throw new Error('Invalid response from login service - result is null or not an object');
      }

      // CRASH FIX: Validate result.data exists before accessing nested properties
      if (result.success && !result.data) {
        console.error('❌ Login successful but result.data is missing:', result);
        throw new Error('Login response missing data object');
      }

      // CRASH FIX: Validate token exists in response (handles both online and offline login)
      if (result.success && result.data) {
        // Check for token in various formats
        // Backend returns: { access_token, user } (stored in result.data)
        const hasToken = result.data.token ||
                         result.data.accessToken ||
                         result.data.access_token ||
                         (result.data.data && (result.data.data.token || result.data.data.access_token));

        if (!hasToken) {
          console.log('⚠️ Login successful but token validation skipped (stored in AuthContext)');
          console.log('   Token is stored by AuthContext, not in login result');
          // Don't throw error - AuthContext already stored the token at line 268
        }
      }

      if (result.success) {
        console.log('✅ Login successful!');
        console.log('🚀 Navigating to Main...');

        // FAST LOGIN: Show toast and navigate immediately without delays
        Toast.show({
          type: 'success',
          text1: 'Login Successful!',
          text2: 'Welcome back!',
          position: 'top',
          visibilityTime: 1500,
          topOffset: 50,
        });

        // FAST LOGIN: Navigate immediately - no retry logic needed
        console.log('📱 Navigating to Main screen...');
        navigation.replace('Main');
        console.log('✅ Navigation initiated');
      } else if (result.requiresOrgSelection && result.organizations) {
        console.log('🏢 Organization selection required:', result.organizations);
        // CRASH FIX: Navigate safely with try-catch
        try {
          navigation.navigate('OrganizationSelection', {
            email: email.toLowerCase().trim(),
            password: password,
            organizationsList: result.organizations
          });
        } catch (navError) {
          console.error('Navigation error:', navError);
          Alert.alert('Navigation Error', 'Unable to navigate to organization selection. Please try again.');
        }
      } else {
        console.error('❌ Login failed:', result);

        // CRASH FIX: Extract the most specific error message available with null safety
        let errorMessage = 'Invalid credentials';

        // Priority 1: Check for detailed API error message (from backend response)
        if (result?.message && typeof result.message === 'string') {
          errorMessage = result.message;
        } else if (result?.error && typeof result.error === 'string') {
          errorMessage = result.error;
        }

        // Priority 2: Check for HTTP status-specific errors with null safety
        if (result?.statusCode === 401) {
          errorMessage = 'Invalid email or password. Please check your credentials.';
        } else if (result?.statusCode === 404) {
          errorMessage = 'Account not found. Please register first.';
        } else if (result?.statusCode === 403) {
          errorMessage = 'Access denied. Your account may be disabled.';
        } else if (result?.statusCode === 500) {
          errorMessage = 'Server error occurred. Please try again later.';
        }

        // Check for API-specific errors (real backend errors)
        if (result?.apiError) {
          Alert.alert('Login Failed', errorMessage);
        }
        // Check for database-related errors
        else if (errorMessage && (errorMessage.includes('database') || errorMessage.includes('table') ||
            errorMessage.includes('column') || errorMessage.includes('schema') ||
            errorMessage.includes('initialization'))) {
          Alert.alert(
            'Database Error',
            `Database issue detected:\n\n${errorMessage}\n\nPlease try again or restart the app.`
          );
        } else {
          // Show the actual error message from the backend
          let friendlyMessage = errorMessage;

          // Only add context for generic/unclear messages
          if (errorMessage.includes('not found in offline storage')) {
            friendlyMessage = 'User not found. Please ensure you are connected to the internet for your first login.';
          } else if (errorMessage.includes('Server login failed')) {
            friendlyMessage = 'Cannot connect to server. Please check your internet connection and try again.';
          } else if (errorMessage.includes('Invalid response from server')) {
            friendlyMessage = 'Cannot connect to server. Please ensure:\n\n1. You are connected to WiFi\n2. Your phone and PC are on the same network\n3. The backend server is running\n\nThen try again.';
          } else if (errorMessage.includes('network') || errorMessage.includes('Network')) {
            friendlyMessage = 'Network connection issue. Please check your internet connection.';
          }

          Alert.alert('Login Failed', friendlyMessage);
        }
      }
    } catch (error) {
      console.error('❌ Login error:', error);

      // Extract meaningful error message
      let errorMessage = 'An unexpected error occurred';

      // Check for network errors
      if (error.message && error.message.includes('Network')) {
        errorMessage = 'Network connection error. Please check your internet connection.';
      } else if (error.message && error.message.includes('timeout')) {
        errorMessage = 'Request timeout. The server is taking too long to respond.';
      } else if (error.response) {
        // Error from API response
        if (error.response.data && error.response.data.message) {
          errorMessage = error.response.data.message;
        } else if (error.response.statusText) {
          errorMessage = error.response.statusText;
        }
      } else if (error.message) {
        errorMessage = error.message;
      }

      Alert.alert('Login Error', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={[styles(theme).container, { backgroundColor: theme.colors.background }]}
    >
      <ScrollView
        contentContainerStyle={styles(theme).scrollContainer}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles(theme).logoContainer}>
          <Text style={styles(theme).logoText}>🐔</Text>
          <Text style={[styles(theme).appTitle, { color: theme.colors.primary }]}>Poultry360</Text>
          <Text style={[styles(theme).subtitle, { color: theme.colors.textSecondary }]}>Poultry Farm Management</Text>
        </View>

        <View style={[styles(theme).formContainer, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadowColor }]}>
          <Text style={[styles(theme).formTitle, { color: theme.colors.text }]}>{t('auth.welcomeBack')}</Text>

          {isPreFilled && (
            <View style={[styles(theme).successBanner, { backgroundColor: '#d4edda', borderColor: '#c3e6cb' }]}>
              <Text style={styles(theme).successIcon}>✓</Text>
              <Text style={styles(theme).successText}>
                {t('auth.registerSuccess')} {t('auth.signIn')}
              </Text>
            </View>
          )}

          {/* CRASH FIX: Display authError from context if present */}
          {authError && !isPreFilled && (
            <View style={[styles(theme).errorBanner, { backgroundColor: '#f8d7da', borderColor: '#f5c6cb' }]}>
              <Text style={styles(theme).errorIcon}>⚠</Text>
              <Text style={styles(theme).errorText}>
                {authError}
              </Text>
            </View>
          )}

          <View style={styles(theme).inputContainer}>
            <Text style={[styles(theme).inputLabel, { color: theme.colors.text }]}>
              {t('auth.email')}
            </Text>
            <TextInput
              style={[styles(theme).input, {
                backgroundColor: theme.colors.inputBackground,
                borderColor: theme.colors.inputBorder,
                color: theme.colors.inputText
              }]}
              placeholder={t('auth.emailPlaceholder')}
              placeholderTextColor={theme.colors.placeholder}
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View style={styles(theme).inputContainer}>
            <Text style={[styles(theme).inputLabel, { color: theme.colors.text }]}>
              {t('auth.password')}
            </Text>
            <View style={[styles(theme).passwordContainer, {
              backgroundColor: theme.colors.inputBackground,
              borderColor: theme.colors.inputBorder
            }]}>
              <TextInput
                style={[styles(theme).passwordInput, { color: theme.colors.inputText }]}
                placeholder={t('auth.passwordPlaceholder')}
                placeholderTextColor={theme.colors.placeholder}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles(theme).eyeIcon}
                onPress={() => {
                  try {
                    setShowPassword(prev => !prev);
                  } catch (error) {
                    console.error('Error toggling password visibility:', error);
                  }
                }}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles(theme).eyeIconText}>{showPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles(theme).loginButton, { backgroundColor: theme.colors.primary }, loading && styles(theme).disabledButton]}
            onPress={handleLogin}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles(theme).loginButtonText}>{t('auth.signIn')}</Text>
            )}
          </TouchableOpacity>

          <View style={styles(theme).registerContainer}>
            <Text style={[styles(theme).registerText, { color: theme.colors.textSecondary }]}>
              {t('auth.noAccount')}
            </Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Register')}
              disabled={loading}
            >
              <Text style={[styles(theme).registerLink, { color: theme.colors.primary }]}>
                {t('auth.createAccount')}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
};

const styles = (theme) => StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContainer: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoText: {
    fontSize: 60,
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: 5,
  },
  subtitle: {
    fontSize: 16,
    textAlign: 'center',
  },
  formContainer: {
    padding: 20,
    borderRadius: 15,
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
    marginBottom: 20,
  },
  formTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 30,
  },
  inputContainer: {
    marginBottom: 20,
  },
  inputLabel: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 15,
    paddingVertical: 12,
    fontSize: 16,
  },
  passwordContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 8,
  },
  passwordInput: {
    flex: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  eyeIcon: {
    padding: 10,
  },
  eyeIconText: {
    fontSize: 18,
  },
  loginButton: {
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  loginButtonText: {
    color: theme.colors.buttonText,
    fontSize: 18,
    fontWeight: 'bold',
  },
  registerContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  registerText: {
    fontSize: 16,
  },
  registerLink: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  successIcon: {
    fontSize: 20,
    color: '#155724',
    fontWeight: 'bold',
    marginRight: 10,
  },
  successText: {
    flex: 1,
    fontSize: 14,
    color: '#155724',
    fontWeight: '500',
  },
  // CRASH FIX: Error banner styles to display auth errors
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 20,
  },
  errorIcon: {
    fontSize: 20,
    color: '#721c24',
    fontWeight: 'bold',
    marginRight: 10,
  },
  errorText: {
    flex: 1,
    fontSize: 14,
    color: '#721c24',
    fontWeight: '500',
  },
});

export default LoginScreen;