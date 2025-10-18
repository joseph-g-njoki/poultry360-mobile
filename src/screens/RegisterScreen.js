import React, { useState } from 'react';
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
  Keyboard,
} from 'react-native';
import CustomPicker from '../components/CustomPicker';
import Toast from 'react-native-toast-message';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';

const RegisterScreen = ({ navigation }) => {
  const [formData, setFormData] = useState({
    username: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    role: 'worker',
    registrationType: 'join', // 'create' or 'join'
    organizationName: '',
    organizationId: '',
    organizationDescription: '',
  });
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [organizations, setOrganizations] = useState([]);
  const [loadingOrgs, setLoadingOrgs] = useState(false);
  const [passwordValidation, setPasswordValidation] = useState({
    minLength: false,
    uppercase: false,
    lowercase: false,
    number: false,
    specialChar: false,
    noSequential: true,
    noCommon: true,
  });

  // CRASH FIX: Add null checks for context hooks
  const authContext = useAuth();
  const themeContext = useTheme();
  const languageContext = useLanguage();

  // CRASH FIX: Validate contexts are available
  if (!authContext || !themeContext || !languageContext) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', padding: 20 }}>
        <Text style={{ fontSize: 18, color: '#FF3B30', marginBottom: 10 }}>{languageContext?.t?.('profile.contextError') || 'Context Error'}</Text>
        <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center' }}>
          Required app contexts are not available. Please restart the app.
        </Text>
      </View>
    );
  }

  const { register } = authContext;
  const { theme } = themeContext;
  const { t } = languageContext;

  // Password validation helper - MUST MATCH BACKEND VALIDATION
  const validatePassword = (password) => {
    // Common passwords list - must match backend
    const commonPasswords = [
      'password', 'password123', '12345678', 'qwerty', 'abc123',
      'monkey', '1234567890', 'letmein', 'trustno1', 'dragon',
      'baseball', 'iloveyou', 'master', 'sunshine', 'ashley',
      'bailey', 'passw0rd', 'shadow', '123123', '654321'
    ];

    // Sequential characters check - must match backend logic
    // Checks for sequences like: 123, abc, qwerty keyboard patterns
    const hasSequentialChars = (pwd) => {
      const sequences = [
        '0123456789', 'abcdefghijklmnopqrstuvwxyz',
        'qwertyuiop', 'asdfghjkl', 'zxcvbnm'
      ];

      for (const sequence of sequences) {
        for (let i = 0; i < sequence.length - 2; i++) {
          const substr = sequence.substring(i, i + 3);
          if (pwd.toLowerCase().includes(substr)) {
            return true;
          }
        }
      }
      return false;
    };

    return {
      minLength: password.length >= 8 && password.length <= 128,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /[0-9]/.test(password),
      specialChar: /[@$!%*?&]/.test(password), // EXACT special chars required by backend
      noSequential: !hasSequentialChars(password),
      noCommon: !commonPasswords.includes(password.toLowerCase()),
    };
  };

  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value,
    }));

    // Real-time password validation
    if (field === 'password') {
      setPasswordValidation(validatePassword(value));
    }
  };

  const handleRegister = async () => {
    // Validation
    const { username, firstName, lastName, email, phone, password, confirmPassword, role } = formData;

    if (!username.trim() || !firstName.trim() || !lastName.trim() || !email.trim() || !phone.trim() || !password.trim() || !confirmPassword.trim()) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    // Username validation - minimum 3 characters, alphanumeric only
    if (username.trim().length < 3) {
      Alert.alert('Invalid Username', 'Username must be at least 3 characters long');
      return;
    }

    // Alphanumeric validation (allows letters, numbers, and underscores only)
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    if (!usernameRegex.test(username.trim())) {
      Alert.alert('Invalid Username', 'Username can only contain letters, numbers, and underscores (no spaces or special characters)');
      return;
    }

    // Organization validation
    if (formData.registrationType === 'create') {
      if (!formData.organizationName.trim()) {
        Alert.alert('Error', 'Organization name is required when creating a new organization');
        return;
      }
    } else if (formData.registrationType === 'join') {
      if (!formData.organizationId) {
        Alert.alert('Error', 'Please select an organization to join');
        return;
      }
    }

    if (!validateEmail(email)) {
      Alert.alert('Error', 'Please enter a valid email address');
      return;
    }

    // Enhanced password validation - MUST MATCH BACKEND REQUIREMENTS
    const pwdValidation = validatePassword(password);
    if (!pwdValidation.minLength) {
      Alert.alert('Invalid Password', 'Password must be 8-128 characters long');
      return;
    }
    if (!pwdValidation.uppercase) {
      Alert.alert('Invalid Password', 'Password must contain at least one uppercase letter (A-Z)');
      return;
    }
    if (!pwdValidation.lowercase) {
      Alert.alert('Invalid Password', 'Password must contain at least one lowercase letter (a-z)');
      return;
    }
    if (!pwdValidation.number) {
      Alert.alert('Invalid Password', 'Password must contain at least one number (0-9)');
      return;
    }
    if (!pwdValidation.specialChar) {
      Alert.alert('Invalid Password', 'Password must contain at least one special character from: @$!%*?&\n\nNote: Only these special characters are allowed.');
      return;
    }
    if (!pwdValidation.noSequential) {
      Alert.alert('Invalid Password', 'Password cannot contain sequential characters.\n\nExamples of NOT allowed:\n• Numbers: 123, 456, 789\n• Letters: abc, def, xyz\n• Keyboard: qwe, asd, zxc');
      return;
    }
    if (!pwdValidation.noCommon) {
      Alert.alert('Invalid Password', 'This password is too common and easily guessed. Please choose a more unique password.');
      return;
    }

    if (password !== confirmPassword) {
      Alert.alert('Error', 'Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      const userData = {
        username: username.toLowerCase().trim(), // FIXED: Normalize username to lowercase to match backend
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.toLowerCase().trim(),
        phone: phone.trim(),
        password: password, // IMPORTANT: Do NOT trim password - spaces can be part of the password
        role: role,
      };

      // Add organization data based on registration type
      if (formData.registrationType === 'create') {
        userData.organizationName = formData.organizationName.trim();
        if (formData.organizationDescription.trim()) {
          userData.organizationDescription = formData.organizationDescription.trim();
        }
      } else if (formData.registrationType === 'join') {
        userData.organizationId = parseInt(formData.organizationId);
      }

      // CRASH FIX: Add null/undefined check before accessing result.success
      const result = await register(userData);

      // CRASH FIX: Validate result is not null/undefined
      if (!result || typeof result !== 'object') {
        console.error('❌ Registration returned invalid result:', result);
        throw new Error('Registration failed - invalid response. Please check your network connection and try again.');
      }

      if (result.success) {
        // Dismiss keyboard for smooth transition
        Keyboard.dismiss();

        console.log('📝 Starting registration...');
        console.log('📡 Sending to API:', { email: userData.email, role: userData.role });
        console.log('📥 Registration response:', result);
        console.log('✅ Registration successful! Navigating to Login...');
        console.log('   - Email:', userData.email);
        console.log('   - Will prefill credentials');

        // CRASH FIX: Show immediate success feedback with Toast
        Toast.show({
          type: 'success',
          text1: 'Registration Successful!',
          text2: 'Redirecting to login...',
          position: 'top',
          visibilityTime: 2000,
          topOffset: 50,
        });

        // Improved navigation with promise handling
        const navigateToLogin = () => {
          setTimeout(async () => {
            try {
              console.log('🚀 Navigating to Login...');
              navigation.navigate('Login', {
                prefilledEmail: userData.email,
                prefilledPassword: userData.password,
              });

              // Clear form data after successful navigation
              setFormData({
                username: '',
                firstName: '',
                lastName: '',
                email: '',
                phone: '',
                password: '',
                confirmPassword: '',
                role: 'worker',
                registrationType: 'join',
                organizationName: '',
                organizationId: '',
                organizationDescription: '',
              });
            } catch (navError) {
              console.error('❌ Navigation error:', navError);
              Alert.alert('Success', 'Account created successfully! Please login manually.');
            }
          }, 300);
        };

        navigateToLogin();
      } else {
        // Extract helpful error message
        let errorMessage = result.error || 'Failed to create account';

        // Handle multiple validation errors
        if (errorMessage.includes('\n\n')) {
          const errors = errorMessage.split('\n\n');
          Toast.show({
            type: 'error',
            text1: 'Registration Failed',
            text2: `${errors.length} validation errors found`,
            position: 'top',
            visibilityTime: 6000,
            topOffset: 50,
          });

          Alert.alert(
            'Registration Errors',
            errors.map((err, i) => `${i + 1}. ${err}`).join('\n\n'),
            [{ text: 'OK' }]
          );
        } else {
          // Single error - existing logic
          let errorDetail = '';

          // Provide specific guidance based on error type
          if (errorMessage.toLowerCase().includes('email')) {
            if (errorMessage.toLowerCase().includes('already') || errorMessage.toLowerCase().includes('exists')) {
              errorDetail = 'This email is already registered. Please use a different email or try logging in.';
            } else {
              errorDetail = 'Please use a valid email address';
            }
          } else if (errorMessage.toLowerCase().includes('password')) {
            errorDetail = 'Password must include uppercase, lowercase, number, special char';
          } else if (errorMessage.toLowerCase().includes('username')) {
            if (errorMessage.toLowerCase().includes('already') || errorMessage.toLowerCase().includes('exists')) {
              errorDetail = 'This username is already taken. Please choose a different username.';
            } else {
              errorDetail = 'Invalid username format. Use only letters, numbers, and underscores (min 3 chars).';
            }
          } else if (errorMessage.toLowerCase().includes('organization')) {
            errorDetail = 'Organization name may already exist';
          } else {
            errorDetail = errorMessage;
          }

          // Show error toast - form data is preserved automatically
          Toast.show({
            type: 'error',
            text1: 'Registration Failed',
            text2: errorDetail,
            position: 'top',
            visibilityTime: 4000,
            topOffset: 50,
          });
        }

        // DO NOT clear form data - user can fix the error and retry
      }
    } catch (error) {
      console.error('Registration error:', error);

      let errorMessage = 'An unexpected error occurred.';
      let errorDetail = 'Please try again';

      if (error.message && error.message.includes('Network')) {
        errorMessage = 'Network Error';
        errorDetail = 'Cannot reach server. Check your connection and try again.';
      } else if (error.message && error.message.includes('timeout')) {
        errorMessage = 'Request Timeout';
        errorDetail = 'Server is taking too long. Check connection and retry.';
      } else {
        errorMessage = 'Error';
        errorDetail = error.message || 'An unexpected error occurred. Please try again.';
      }

      // Show error toast - form data is preserved automatically
      Toast.show({
        type: 'error',
        text1: errorMessage,
        text2: errorDetail,
        position: 'top',
        visibilityTime: 5000,
        topOffset: 50,
      });

      // DO NOT clear form data - user can retry without losing their inputs
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
          <Text style={[styles(theme).appTitle, { color: theme.colors.primary }]}>{t('auth.joinPoultry360') || 'Join Poultry360'}</Text>
          <Text style={[styles(theme).subtitle, { color: theme.colors.textSecondary }]}>{t('auth.startManaging') || 'Start managing your poultry farm'}</Text>
        </View>

        <View style={[styles(theme).formContainer, { backgroundColor: theme.colors.surface, shadowColor: theme.colors.shadowColor }]}>
          <Text style={[styles(theme).formTitle, { color: theme.colors.text }]}>{t('auth.createAccount')}</Text>

          <View style={styles(theme).inputContainer}>
            <Text style={[styles(theme).inputLabel, { color: theme.colors.text }]}>{t('auth.username')} *</Text>
            <TextInput
              style={[styles(theme).input, {
                backgroundColor: theme.colors.inputBackground,
                borderColor: theme.colors.inputBorder,
                color: theme.colors.inputText
              }]}
              placeholder={t('auth.enterUsername')}
              placeholderTextColor={theme.colors.placeholder}
              value={formData.username}
              onChangeText={(value) => handleInputChange('username', value)}
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
            <Text style={[styles(theme).inputHint, { color: theme.colors.textSecondary }]}>
              Minimum 3 characters. Letters, numbers, and underscores only.
            </Text>
          </View>

          <View style={styles(theme).row}>
            <View style={[styles(theme).inputContainer, styles(theme).halfWidth]}>
              <Text style={[styles(theme).inputLabel, { color: theme.colors.text }]}>{t('auth.firstName')}</Text>
              <TextInput
                style={[styles(theme).input, {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.inputBorder,
                  color: theme.colors.inputText
                }]}
                placeholder={t('auth.enterFirstName')}
                placeholderTextColor={theme.colors.placeholder}
                value={formData.firstName}
                onChangeText={(value) => handleInputChange('firstName', value)}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>

            <View style={[styles(theme).inputContainer, styles(theme).halfWidth]}>
              <Text style={[styles(theme).inputLabel, { color: theme.colors.text }]}>{t('auth.lastName')}</Text>
              <TextInput
                style={[styles(theme).input, {
                  backgroundColor: theme.colors.inputBackground,
                  borderColor: theme.colors.inputBorder,
                  color: theme.colors.inputText
                }]}
                placeholder={t('auth.enterLastName')}
                placeholderTextColor={theme.colors.placeholder}
                value={formData.lastName}
                onChangeText={(value) => handleInputChange('lastName', value)}
                autoCapitalize="words"
                editable={!loading}
              />
            </View>
          </View>

          <View style={styles(theme).inputContainer}>
            <Text style={[styles(theme).inputLabel, { color: theme.colors.text }]}>{t('auth.email')}</Text>
            <TextInput
              style={[styles(theme).input, {
                backgroundColor: theme.colors.inputBackground,
                borderColor: theme.colors.inputBorder,
                color: theme.colors.inputText
              }]}
              placeholder={t('auth.enterEmail')}
              placeholderTextColor={theme.colors.placeholder}
              value={formData.email}
              onChangeText={(value) => handleInputChange('email', value)}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!loading}
            />
          </View>

          <View style={styles(theme).inputContainer}>
            <Text style={[styles(theme).inputLabel, { color: theme.colors.text }]}>{t('auth.phoneNumber')}</Text>
            <TextInput
              style={[styles(theme).input, {
                backgroundColor: theme.colors.inputBackground,
                borderColor: theme.colors.inputBorder,
                color: theme.colors.inputText
              }]}
              placeholder={t('auth.enterPhone')}
              placeholderTextColor={theme.colors.placeholder}
              value={formData.phone}
              onChangeText={(value) => handleInputChange('phone', value)}
              keyboardType="phone-pad"
              editable={!loading}
            />
          </View>

          <View style={styles(theme).inputContainer}>
            <Text style={[styles(theme).inputLabel, { color: theme.colors.text }]}>Registration Type</Text>
            <CustomPicker
              selectedValue={formData.registrationType}
              onValueChange={(value) => handleInputChange('registrationType', value)}
              items={[
                { label: '🏢 Join Existing Organization', value: 'join' },
                { label: '🆕 Create New Organization', value: 'create' }
              ]}
              enabled={!loading}
            />
          </View>

          {formData.registrationType === 'create' && (
            <>
              <View style={styles(theme).inputContainer}>
                <Text style={[styles(theme).inputLabel, { color: theme.colors.text }]}>{t('auth.organizationName')} *</Text>
                <TextInput
                  style={[styles(theme).input, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder={t('auth.enterOrgName')}
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.organizationName}
                  onChangeText={(value) => handleInputChange('organizationName', value)}
                  autoCapitalize="words"
                  editable={!loading}
                />
              </View>

              <View style={styles(theme).inputContainer}>
                <Text style={[styles(theme).inputLabel, { color: theme.colors.text }]}>Organization Description (Optional)</Text>
                <TextInput
                  style={[styles(theme).input, {
                    backgroundColor: theme.colors.inputBackground,
                    borderColor: theme.colors.inputBorder,
                    color: theme.colors.inputText
                  }]}
                  placeholder="Brief description of your organization"
                  placeholderTextColor={theme.colors.placeholder}
                  value={formData.organizationDescription}
                  onChangeText={(value) => handleInputChange('organizationDescription', value)}
                  multiline
                  numberOfLines={3}
                  editable={!loading}
                />
              </View>
            </>
          )}

          {formData.registrationType === 'join' && (
            <View style={styles(theme).inputContainer}>
              <Text style={[styles(theme).inputLabel, { color: theme.colors.text }]}>Select Organization *</Text>
              <CustomPicker
                selectedValue={formData.organizationId}
                onValueChange={(value) => handleInputChange('organizationId', value)}
                items={[
                  { label: 'Demo Poultry Farm', value: '1' },
                  { label: 'Sunrise Poultry Co.', value: '2' }
                ]}
                placeholder="Select an organization..."
                enabled={!loading && !loadingOrgs}
              />
            </View>
          )}

          <View style={styles(theme).inputContainer}>
            <Text style={[styles(theme).inputLabel, { color: theme.colors.text }]}>Role</Text>
            <CustomPicker
              selectedValue={formData.role}
              onValueChange={(value) => handleInputChange('role', value)}
              items={[
                { label: '👷 Worker', value: 'worker' },
                { label: '👨‍💼 Manager', value: 'manager' },
                { label: '⭐ Admin', value: 'admin' },
                { label: '👑 Owner', value: 'owner' }
              ]}
              enabled={!loading}
            />
            <Text style={[styles(theme).inputHint, { color: theme.colors.textSecondary }]}>
              {formData.registrationType === 'create'
                ? 'Select your role in the new organization'
                : 'Select your role. Admin/Owner roles require approval.'}
            </Text>
          </View>

          {/* Password Requirements Section */}
          <View style={[styles(theme).passwordRequirementsContainer, {
            backgroundColor: theme.colors.inputBackground || '#f8f9fa',
            borderColor: theme.colors.inputBorder || '#dee2e6'
          }]}>
            <Text style={[styles(theme).passwordRequirementsTitle, { color: theme.colors.text }]}>
              {t('auth.passwordRequirements') || 'Password Requirements'}
            </Text>
            <View style={styles(theme).requirementsList}>
              <View style={styles(theme).requirementItem}>
                <Text style={[styles(theme).requirementIcon, passwordValidation.minLength && styles(theme).requirementMet]}>
                  {passwordValidation.minLength ? '✓' : '○'}
                </Text>
                <Text style={[styles(theme).requirementText, { color: theme.colors.textSecondary }, passwordValidation.minLength && styles(theme).requirementTextMet]}>
                  {t('auth.minLength') || 'At least 8 characters'}
                </Text>
              </View>
              <View style={styles(theme).requirementItem}>
                <Text style={[styles(theme).requirementIcon, passwordValidation.uppercase && styles(theme).requirementMet]}>
                  {passwordValidation.uppercase ? '✓' : '○'}
                </Text>
                <Text style={[styles(theme).requirementText, { color: theme.colors.textSecondary }, passwordValidation.uppercase && styles(theme).requirementTextMet]}>
                  {t('auth.uppercase') || 'One uppercase letter (A-Z)'}
                </Text>
              </View>
              <View style={styles(theme).requirementItem}>
                <Text style={[styles(theme).requirementIcon, passwordValidation.lowercase && styles(theme).requirementMet]}>
                  {passwordValidation.lowercase ? '✓' : '○'}
                </Text>
                <Text style={[styles(theme).requirementText, { color: theme.colors.textSecondary }, passwordValidation.lowercase && styles(theme).requirementTextMet]}>
                  {t('auth.lowercase') || 'One lowercase letter (a-z)'}
                </Text>
              </View>
              <View style={styles(theme).requirementItem}>
                <Text style={[styles(theme).requirementIcon, passwordValidation.number && styles(theme).requirementMet]}>
                  {passwordValidation.number ? '✓' : '○'}
                </Text>
                <Text style={[styles(theme).requirementText, { color: theme.colors.textSecondary }, passwordValidation.number && styles(theme).requirementTextMet]}>
                  {t('auth.number') || 'One number (0-9)'}
                </Text>
              </View>
              <View style={styles(theme).requirementItem}>
                <Text style={[styles(theme).requirementIcon, passwordValidation.specialChar && styles(theme).requirementMet]}>
                  {passwordValidation.specialChar ? '✓' : '○'}
                </Text>
                <Text style={[styles(theme).requirementText, { color: theme.colors.textSecondary }, passwordValidation.specialChar && styles(theme).requirementTextMet]}>
                  {t('auth.specialChar') || 'One special character (@$!%*?&)'}
                </Text>
              </View>
              <View style={styles(theme).requirementItem}>
                <Text style={[styles(theme).requirementIcon, passwordValidation.noCommon && styles(theme).requirementMet]}>
                  {passwordValidation.noCommon ? '✓' : '○'}
                </Text>
                <Text style={[styles(theme).requirementText, { color: theme.colors.textSecondary }, passwordValidation.noCommon && styles(theme).requirementTextMet]}>
                  {t('auth.noCommon') || 'No common passwords'}
                </Text>
              </View>
              <View style={styles(theme).requirementItem}>
                <Text style={[styles(theme).requirementIcon, passwordValidation.noSequential && styles(theme).requirementMet]}>
                  {passwordValidation.noSequential ? '✓' : '○'}
                </Text>
                <Text style={[styles(theme).requirementText, { color: theme.colors.textSecondary }, passwordValidation.noSequential && styles(theme).requirementTextMet]}>
                  {t('auth.noSequential') || 'No sequential characters'}
                </Text>
              </View>
            </View>
          </View>

          <View style={styles(theme).inputContainer}>
            <Text style={[styles(theme).inputLabel, { color: theme.colors.text }]}>{t('auth.password')}</Text>
            <View style={[styles(theme).passwordContainer, {
              backgroundColor: theme.colors.inputBackground,
              borderColor: theme.colors.inputBorder
            }]}>
              <TextInput
                style={[styles(theme).passwordInput, { color: theme.colors.inputText }]}
                placeholder={t('auth.enterPassword')}
                placeholderTextColor={theme.colors.placeholder}
                value={formData.password}
                onChangeText={(value) => handleInputChange('password', value)}
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

          <View style={styles(theme).inputContainer}>
            <Text style={[styles(theme).inputLabel, { color: theme.colors.text }]}>{t('auth.confirmPassword')}</Text>
            <View style={[styles(theme).passwordContainer, {
              backgroundColor: theme.colors.inputBackground,
              borderColor: theme.colors.inputBorder
            }]}>
              <TextInput
                style={[styles(theme).passwordInput, { color: theme.colors.inputText }]}
                placeholder={t('auth.confirmPassword')}
                placeholderTextColor={theme.colors.placeholder}
                value={formData.confirmPassword}
                onChangeText={(value) => handleInputChange('confirmPassword', value)}
                secureTextEntry={!showConfirmPassword}
                editable={!loading}
              />
              <TouchableOpacity
                style={styles(theme).eyeIcon}
                onPress={() => {
                  try {
                    setShowConfirmPassword(prev => !prev);
                  } catch (error) {
                    console.error('Error toggling confirm password visibility:', error);
                  }
                }}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={styles(theme).eyeIconText}>{showConfirmPassword ? '🙈' : '👁️'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity
            style={[styles(theme).registerButton, { backgroundColor: theme.colors.primary }, loading && styles(theme).disabledButton]}
            onPress={handleRegister}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" size="small" />
            ) : (
              <Text style={styles(theme).registerButtonText}>{t('auth.createAccount')}</Text>
            )}
          </TouchableOpacity>

          <View style={styles(theme).loginContainer}>
            <Text style={[styles(theme).loginText, { color: theme.colors.textSecondary }]}>{t('auth.alreadyHaveAccount')}</Text>
            <TouchableOpacity
              onPress={() => navigation.navigate('Login')}
              disabled={loading}
            >
              <Text style={[styles(theme).loginLink, { color: theme.colors.primary }]}>{t('auth.signIn')}</Text>
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
    paddingVertical: 20,
  },
  logoContainer: {
    alignItems: 'center',
    marginBottom: 30,
  },
  logoText: {
    fontSize: 50,
    marginBottom: 10,
  },
  appTitle: {
    fontSize: 28,
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
  },
  formTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 25,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  inputContainer: {
    marginBottom: 15,
  },
  halfWidth: {
    width: '48%',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 6,
  },
  inputHint: {
    fontSize: 12,
    marginTop: 4,
    fontStyle: 'italic',
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  pickerContainer: {
    borderWidth: 1,
    borderRadius: 8,
  },
  picker: {
    height: 50,
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
  registerButton: {
    borderRadius: 8,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 10,
  },
  disabledButton: {
    backgroundColor: '#ccc',
  },
  registerButtonText: {
    color: theme.colors.buttonText,
    fontSize: 18,
    fontWeight: 'bold',
  },
  loginContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 20,
  },
  loginText: {
    fontSize: 16,
  },
  loginLink: {
    fontSize: 16,
    fontWeight: 'bold',
    marginLeft: 5,
  },
  passwordRequirementsContainer: {
    marginBottom: 15,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
  },
  passwordRequirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 10,
  },
  requirementsList: {
    gap: 6,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  requirementIcon: {
    fontSize: 14,
    marginRight: 8,
    width: 20,
    color: theme.colors.textSecondary,
  },
  requirementMet: {
    color: '#2ecc71',
    fontWeight: 'bold',
  },
  requirementText: {
    fontSize: 13,
    flex: 1,
  },
  requirementTextMet: {
    color: '#2ecc71',
    fontWeight: '500',
  },
});

export default RegisterScreen;