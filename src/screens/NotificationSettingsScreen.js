import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import notificationService from '../services/notificationService';

export default function NotificationSettingsScreen() {
  const [loading, setLoading] = useState(true);
  const [dailyEntryReminder, setDailyEntryReminder] = useState(true);
  const [vaccinationReminder, setVaccinationReminder] = useState(true);
  const [language, setLanguage] = useState('en');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const settings = await notificationService.getNotificationSettings();

      if (settings) {
        setDailyEntryReminder(settings.dailyEntryReminder ?? true);
        setVaccinationReminder(settings.vaccinationReminder ?? true);
        setLanguage(settings.language ?? 'en');
      }
    } catch (error) {
      console.error('Failed to load notification settings:', error);
      Alert.alert('Error', 'Failed to load notification settings');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key, value) => {
    try {
      const success = await notificationService.updateNotificationSettings({
        [key]: value,
      });

      if (success) {
        console.log(`Updated ${key} to ${value}`);
      } else {
        Alert.alert('Error', `Failed to update ${key}`);
        // Revert the change
        loadSettings();
      }
    } catch (error) {
      console.error(`Failed to update ${key}:`, error);
      Alert.alert('Error', `Failed to update ${key}`);
      // Revert the change
      loadSettings();
    }
  };

  const testNotification = async () => {
    try {
      await notificationService.scheduleLocalNotification(
        'Test Notification',
        'This is a test notification from Poultry360',
        { type: 'test' },
        2
      );
      Alert.alert('Success', 'Test notification will appear in 2 seconds');
    } catch (error) {
      Alert.alert('Error', 'Failed to send test notification');
    }
  };

  const getLanguageName = (code) => {
    const languages = {
      en: 'English',
      sw: 'Swahili',
      lg: 'Luganda',
    };
    return languages[code] || code;
  };

  if (loading) {
    return (
      <ScreenWrapper>
        <View style={styles.container}>
          <Text style={styles.loadingText}>Loading settings...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView style={styles.container}>
        <Text style={styles.title}>Notification Settings</Text>
        <Text style={styles.subtitle}>
          Manage your notification preferences
        </Text>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Reminders</Text>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Daily Entry Reminders</Text>
              <Text style={styles.settingDescription}>
                Get reminded to record daily feeding and mortality data
              </Text>
            </View>
            <Switch
              value={dailyEntryReminder}
              onValueChange={(value) => {
                try {
                  setDailyEntryReminder(value);
                  updateSetting('dailyEntryReminder', value);
                } catch (error) {
                  console.error('Error updating daily entry reminder:', error);
                }
              }}
              trackColor={{ false: '#767577', true: '#81c784' }}
              thumbColor={dailyEntryReminder ? '#4CAF50' : '#f4f3f4'}
              disabled={loading}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Vaccination Reminders</Text>
              <Text style={styles.settingDescription}>
                Get notified about upcoming vaccinations
              </Text>
            </View>
            <Switch
              value={vaccinationReminder}
              onValueChange={(value) => {
                try {
                  setVaccinationReminder(value);
                  updateSetting('vaccinationReminder', value);
                } catch (error) {
                  console.error('Error updating vaccination reminder:', error);
                }
              }}
              trackColor={{ false: '#767577', true: '#81c784' }}
              thumbColor={vaccinationReminder ? '#4CAF50' : '#f4f3f4'}
              disabled={loading}
            />
          </View>
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Language</Text>
          <Text style={styles.sectionDescription}>
            Choose the language for your notifications
          </Text>

          {['en', 'sw', 'lg'].map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.languageOption,
                language === lang && styles.languageOptionSelected,
              ]}
              onPress={() => {
                try {
                  setLanguage(lang);
                  updateSetting('language', lang);
                } catch (error) {
                  console.error('Error updating language:', error);
                }
              }}
              activeOpacity={0.7}
              disabled={loading}
            >
              <Text
                style={[
                  styles.languageText,
                  language === lang && styles.languageTextSelected,
                ]}
              >
                {getLanguageName(lang)}
              </Text>
              {language === lang && (
                <View style={styles.checkmark}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Testing</Text>
          <TouchableOpacity
            style={styles.testButton}
            onPress={testNotification}
            activeOpacity={0.7}
            disabled={loading}
          >
            <Text style={styles.testButtonText}>Send Test Notification</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.infoBox}>
          <Text style={styles.infoText}>
            Daily reminders are sent at 6:00 PM if you haven't recorded your data yet.
          </Text>
          <Text style={styles.infoText}>
            Vaccination reminders are sent at 8:00 AM one day before the scheduled date.
          </Text>
        </View>
      </ScrollView>
    </ScreenWrapper>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  loadingText: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: '#666',
    marginBottom: 24,
  },
  section: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#666',
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#ddd',
    marginBottom: 8,
    backgroundColor: '#fff',
  },
  languageOptionSelected: {
    borderColor: '#4CAF50',
    backgroundColor: '#f1f8f4',
  },
  languageText: {
    fontSize: 16,
    color: '#333',
  },
  languageTextSelected: {
    color: '#4CAF50',
    fontWeight: '600',
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#4CAF50',
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  testButton: {
    backgroundColor: '#2196F3',
    padding: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  testButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  infoBox: {
    backgroundColor: '#fff3cd',
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    color: '#856404',
    marginBottom: 8,
    lineHeight: 20,
  },
});