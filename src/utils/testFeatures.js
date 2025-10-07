// Test utility for the new app settings features
import AsyncStorage from '@react-native-async-storage/async-storage';

export const testThemeSettings = async () => {
  console.log('Testing theme settings...');

  // Test theme preference storage
  await AsyncStorage.setItem('@theme_preference', 'dark');
  const theme = await AsyncStorage.getItem('@theme_preference');
  console.log('Stored theme:', theme);

  // Clear test data
  await AsyncStorage.removeItem('@theme_preference');
  console.log('Theme settings test completed');
};

export const testLanguageSettings = async () => {
  console.log('Testing language settings...');

  // Test language preference storage
  await AsyncStorage.setItem('@language_preference', 'es');
  const language = await AsyncStorage.getItem('@language_preference');
  console.log('Stored language:', language);

  // Clear test data
  await AsyncStorage.removeItem('@language_preference');
  console.log('Language settings test completed');
};

export const testNotificationSettings = async () => {
  console.log('Testing notification settings...');

  const testSettings = {
    pushNotifications: true,
    emailNotifications: false,
    reminderNotifications: true,
    alertNotifications: true,
    updateNotifications: false,
  };

  // Test notification settings storage
  await AsyncStorage.setItem('@notification_settings', JSON.stringify(testSettings));
  const stored = await AsyncStorage.getItem('@notification_settings');
  const parsedSettings = JSON.parse(stored);
  console.log('Stored notification settings:', parsedSettings);

  // Clear test data
  await AsyncStorage.removeItem('@notification_settings');
  console.log('Notification settings test completed');
};

export const testBackupData = async () => {
  console.log('Testing backup data creation...');

  // Create some test data
  await AsyncStorage.setItem('@test_key_1', 'test_value_1');
  await AsyncStorage.setItem('@test_key_2', 'test_value_2');

  // Get all keys and create mock backup
  const allKeys = await AsyncStorage.getAllKeys();
  const appDataKeys = allKeys.filter(key => key.startsWith('@test_'));

  const backupData = {
    exportedAt: new Date().toISOString(),
    version: '1.0.0',
    data: {},
  };

  for (const key of appDataKeys) {
    const value = await AsyncStorage.getItem(key);
    if (value !== null) {
      backupData.data[key] = value;
    }
  }

  console.log('Mock backup data:', backupData);

  // Clear test data
  await AsyncStorage.multiRemove(appDataKeys);
  console.log('Backup data test completed');
};

export const runAllTests = async () => {
  console.log('=== Running all app settings tests ===');

  try {
    await testThemeSettings();
    await testLanguageSettings();
    await testNotificationSettings();
    await testBackupData();

    console.log('=== All tests completed successfully ===');
    return true;
  } catch (error) {
    console.error('Test failed:', error);
    return false;
  }
};