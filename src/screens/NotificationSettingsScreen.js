import React, { useState, useEffect } from 'react';
import { View, Text, Switch, StyleSheet, ScrollView, TouchableOpacity, Alert } from 'react-native';
import ScreenWrapper from '../components/ScreenWrapper';
import { useTheme } from '../context/ThemeContext';
import notificationService from '../services/notificationService';

export default function NotificationSettingsScreen() {
  const { theme } = useTheme();
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
        <View style={[styles.container, { backgroundColor: theme.colors.background }]}>
          <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>Loading settings...</Text>
        </View>
      </ScreenWrapper>
    );
  }

  return (
    <ScreenWrapper>
      <ScrollView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Notification Settings</Text>
        <Text style={[styles.subtitle, { color: theme.colors.textSecondary }]}>
          Manage your notification preferences
        </Text>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Reminders</Text>

          <View style={[styles.settingRow, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Daily Entry Reminders</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
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
              trackColor={{ false: theme.colors.border, true: '#81c784' }}
              thumbColor={dailyEntryReminder ? theme.colors.primary : theme.colors.textLight}
              disabled={loading}
            />
          </View>

          <View style={[styles.settingRow, { borderBottomColor: theme.colors.border }]}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.colors.text }]}>Vaccination Reminders</Text>
              <Text style={[styles.settingDescription, { color: theme.colors.textSecondary }]}>
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
              trackColor={{ false: theme.colors.border, true: '#81c784' }}
              thumbColor={vaccinationReminder ? theme.colors.primary : theme.colors.textLight}
              disabled={loading}
            />
          </View>
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Language</Text>
          <Text style={[styles.sectionDescription, { color: theme.colors.textSecondary }]}>
            Choose the language for your notifications
          </Text>

          {['en', 'sw', 'lg'].map((lang) => (
            <TouchableOpacity
              key={lang}
              style={[
                styles.languageOption,
                {
                  backgroundColor: theme.colors.surface,
                  borderColor: language === lang ? theme.colors.primary : theme.colors.border
                },
                language === lang && { backgroundColor: theme.colors.primary + '20' },
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
                  { color: language === lang ? theme.colors.primary : theme.colors.text },
                  language === lang && { fontWeight: '600' },
                ]}
              >
                {getLanguageName(lang)}
              </Text>
              {language === lang && (
                <View style={[styles.checkmark, { backgroundColor: theme.colors.primary }]}>
                  <Text style={styles.checkmarkText}>✓</Text>
                </View>
              )}
            </TouchableOpacity>
          ))}
        </View>

        <View style={[styles.section, { backgroundColor: theme.colors.surface }]}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Testing</Text>
          <TouchableOpacity
            style={[styles.testButton, { backgroundColor: theme.colors.info }]}
            onPress={testNotification}
            activeOpacity={0.7}
            disabled={loading}
          >
            <Text style={styles.testButtonText}>Send Test Notification</Text>
          </TouchableOpacity>
        </View>

        <View style={[styles.infoBox, { backgroundColor: theme.colors.warning + '20' }]}>
          <Text style={[styles.infoText, { color: theme.colors.text }]}>
            Daily reminders are sent at 6:00 PM if you haven't recorded your data yet.
          </Text>
          <Text style={[styles.infoText, { color: theme.colors.text }]}>
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
  },
  loadingText: {
    fontSize: 16,
    textAlign: 'center',
    marginTop: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    marginBottom: 24,
  },
  section: {
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
    marginBottom: 12,
  },
  sectionDescription: {
    fontSize: 14,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
  },
  languageOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 8,
  },
  languageText: {
    fontSize: 16,
  },
  checkmark: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkmarkText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
  testButton: {
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
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  infoText: {
    fontSize: 14,
    marginBottom: 8,
    lineHeight: 20,
  },
});