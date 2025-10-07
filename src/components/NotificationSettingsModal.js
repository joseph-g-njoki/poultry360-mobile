import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Switch,
  ScrollView,
  Alert,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { safeRender, safeTranslation } from '../utils/safeRender';

const NotificationSettingsModal = ({ visible, onClose }) => {
  const { theme } = useTheme();
  const { t } = useLanguage();

  const [notifications, setNotifications] = useState({
    pushNotifications: true,
    emailNotifications: true,
    reminderNotifications: true,
    alertNotifications: true,
    updateNotifications: false,
  });
  const [loading, setLoading] = useState(false);

  // Load notification preferences from AsyncStorage
  useEffect(() => {
    if (visible) {
      loadNotificationSettings();
    }
  }, [visible]);

  const loadNotificationSettings = async () => {
    try {
      const savedSettings = await AsyncStorage.getItem('@notification_settings');
      if (savedSettings !== null) {
        const parsedSettings = JSON.parse(savedSettings);
        setNotifications(parsedSettings);
      }
    } catch (error) {
      console.error('Error loading notification settings:', error);
    }
  };

  const saveNotificationSettings = async (newSettings) => {
    try {
      await AsyncStorage.setItem('@notification_settings', JSON.stringify(newSettings));
    } catch (error) {
      console.error('Error saving notification settings:', error);
      Alert.alert(t('error'), 'Failed to save notification settings');
    }
  };

  const toggleNotification = (key) => {
    const newSettings = {
      ...notifications,
      [key]: !notifications[key],
    };
    setNotifications(newSettings);
    saveNotificationSettings(newSettings);
  };

  const NotificationToggle = ({ icon, title, description, settingKey }) => {
    // SAFETY: Ensure all text values are strings, never objects
    const safeIcon = safeRender(icon, '🔔');
    const safeTitle = safeRender(title, 'Notification');
    const safeDescription = safeRender(description, '');
    const safeKey = String(settingKey);

    // SAFETY: Ensure notification value is a boolean
    const notificationValue = !!notifications[safeKey];

    return (
      <View style={[styles.toggleItem, { borderBottomColor: theme.colors.border }]}>
        <View style={styles.toggleLeft}>
          <Text style={styles.toggleIcon}>{safeIcon}</Text>
          <View style={styles.toggleContent}>
            <Text style={[styles.toggleTitle, { color: theme.colors.text }]}>
              {safeTitle}
            </Text>
            <Text style={[styles.toggleDescription, { color: theme.colors.textSecondary }]}>
              {safeDescription}
            </Text>
          </View>
        </View>
        <Switch
          value={notificationValue}
          onValueChange={() => toggleNotification(safeKey)}
          trackColor={{ false: theme.colors.border, true: theme.colors.primary }}
          thumbColor={notificationValue ? '#fff' : '#f4f3f4'}
        />
      </View>
    );
  };

  const styles = StyleSheet.create({
    modalOverlay: {
      flex: 1,
      backgroundColor: theme.colors.overlay,
      justifyContent: 'center',
      alignItems: 'center',
    },
    modalContent: {
      backgroundColor: theme.colors.surface,
      borderRadius: 15,
      width: '90%',
      maxHeight: '80%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      padding: 20,
      borderBottomWidth: 1,
      borderBottomColor: theme.colors.border,
    },
    title: {
      fontSize: 20,
      fontWeight: 'bold',
      color: theme.colors.text,
    },
    closeButton: {
      padding: 5,
    },
    closeButtonText: {
      fontSize: 18,
      color: theme.colors.textSecondary,
    },
    content: {
      flex: 1,
    },
    section: {
      padding: 20,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: '600',
      color: theme.colors.text,
      marginBottom: 15,
    },
    toggleItem: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 15,
      borderBottomWidth: 1,
    },
    toggleLeft: {
      flexDirection: 'row',
      alignItems: 'center',
      flex: 1,
    },
    toggleIcon: {
      fontSize: 22,
      marginRight: 15,
      width: 30,
      textAlign: 'center',
    },
    toggleContent: {
      flex: 1,
    },
    toggleTitle: {
      fontSize: 16,
      fontWeight: '500',
      marginBottom: 2,
    },
    toggleDescription: {
      fontSize: 14,
      lineHeight: 18,
    },
    footer: {
      padding: 20,
      borderTopWidth: 1,
      borderTopColor: theme.colors.border,
    },
    statusText: {
      fontSize: 14,
      color: theme.colors.textSecondary,
      textAlign: 'center',
      fontStyle: 'italic',
    },
  });

  return (
    <Modal
      animationType="slide"
      transparent={true}
      visible={visible}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{safeTranslation(t, 'profile.notificationSettings', 'Notification Settings')}</Text>
            <TouchableOpacity
              style={styles.closeButton}
              onPress={onClose}
              activeOpacity={0.7}
            >
              <Text style={styles.closeButtonText}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
            <View style={styles.section}>
              <NotificationToggle
                icon="🔔"
                title={safeTranslation(t, 'profile.pushNotifications', 'Push Notifications')}
                description="Receive push notifications on your device"
                settingKey="pushNotifications"
              />
              <NotificationToggle
                icon="📧"
                title={safeTranslation(t, 'profile.emailNotifications', 'Email Notifications')}
                description="Receive notifications via email"
                settingKey="emailNotifications"
              />
              <NotificationToggle
                icon="⏰"
                title={safeTranslation(t, 'profile.reminderNotifications', 'Reminder Notifications')}
                description="Get reminded about important tasks and deadlines"
                settingKey="reminderNotifications"
              />
              <NotificationToggle
                icon="🚨"
                title={safeTranslation(t, 'profile.alertNotifications', 'Alert Notifications')}
                description="Receive urgent alerts and warnings"
                settingKey="alertNotifications"
              />
              <NotificationToggle
                icon="📱"
                title={safeTranslation(t, 'profile.updateNotifications', 'Update Notifications')}
                description="Get notified about app updates and new features"
                settingKey="updateNotifications"
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Text style={styles.statusText}>
              Settings are automatically saved
            </Text>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default NotificationSettingsModal;