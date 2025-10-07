import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import api from './api';

// Configure notification behavior
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

class NotificationService {
  constructor() {
    this.notificationListener = null;
    this.responseListener = null;
  }

  /**
   * Register for push notifications and get Expo push token
   * @returns {Promise<string|null>} Expo push token or null if failed
   */
  async registerForPushNotifications() {
    try {
      if (!Device.isDevice) {
        console.log('[Notifications] Must use physical device for push notifications');
        return null;
      }

      // Check existing permissions
      const { status: existingStatus } = await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      // Request permissions if not granted
      if (existingStatus !== 'granted') {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      if (finalStatus !== 'granted') {
        console.log('[Notifications] Failed to get push token - permission denied');
        return null;
      }

      // Get Expo push token
      const projectId = Constants.expoConfig?.extra?.eas?.projectId || 'poultry360';
      const token = (await Notifications.getExpoPushTokenAsync({
        projectId,
      })).data;

      console.log('[Notifications] Expo Push Token:', token);

      // Configure Android channel
      if (Platform.OS === 'android') {
        await Notifications.setNotificationChannelAsync('default', {
          name: 'default',
          importance: Notifications.AndroidImportance.MAX,
          vibrationPattern: [0, 250, 250, 250],
          lightColor: '#4CAF50',
        });
      }

      return token;
    } catch (error) {
      console.error('[Notifications] Error registering for push notifications:', error);
      return null;
    }
  }

  /**
   * Register device with backend API
   * @param {string} token - Expo push token
   * @returns {Promise<boolean>} Success status
   */
  async registerDeviceWithBackend(token) {
    try {
      if (!token) {
        console.log('[Notifications] No token provided for backend registration');
        return false;
      }

      const deviceId = Constants.deviceId || Constants.installationId || `device-${Date.now()}`;
      const platform = Platform.OS;

      console.log('[Notifications] Registering device with backend:', { deviceId, platform });

      const response = await api.post('/notifications/register-device', {
        expoPushToken: token,
        deviceId,
        platform,
      });

      if (response.data.success) {
        console.log('[Notifications] Device registered successfully with backend');
        return true;
      } else {
        console.log('[Notifications] Device registration failed:', response.data);
        return false;
      }
    } catch (error) {
      console.error('[Notifications] Failed to register device with backend:', error);
      return false;
    }
  }

  /**
   * Setup notifications (register and configure)
   * @returns {Promise<string|null>} Expo push token or null
   */
  async setupNotifications() {
    try {
      console.log('[Notifications] Setting up notifications...');

      const token = await this.registerForPushNotifications();

      if (token) {
        await this.registerDeviceWithBackend(token);
      }

      return token;
    } catch (error) {
      console.error('[Notifications] Setup failed:', error);
      return null;
    }
  }

  /**
   * Add listener for incoming notifications
   * @param {Function} callback - Callback function (notification) => void
   * @returns {Subscription} Subscription object
   */
  addNotificationReceivedListener(callback) {
    return Notifications.addNotificationReceivedListener(callback);
  }

  /**
   * Add listener for notification interactions (taps)
   * @param {Function} callback - Callback function (response) => void
   * @returns {Subscription} Subscription object
   */
  addNotificationResponseReceivedListener(callback) {
    return Notifications.addNotificationResponseReceivedListener(callback);
  }

  /**
   * Schedule a local notification for testing
   * @param {string} title - Notification title
   * @param {string} body - Notification body
   * @param {object} data - Additional data
   * @param {number} seconds - Delay in seconds
   */
  async scheduleLocalNotification(title, body, data = {}, seconds = 1) {
    try {
      await Notifications.scheduleNotificationAsync({
        content: {
          title,
          body,
          data,
          sound: true,
        },
        trigger: { seconds },
      });
      console.log('[Notifications] Local notification scheduled');
    } catch (error) {
      console.error('[Notifications] Failed to schedule local notification:', error);
    }
  }

  /**
   * Get notification settings from backend
   * @returns {Promise<object|null>} Notification settings or null
   */
  async getNotificationSettings() {
    try {
      const response = await api.get('/notifications/settings');
      return response.data;
    } catch (error) {
      console.error('[Notifications] Failed to get settings:', error);
      return null;
    }
  }

  /**
   * Update notification settings
   * @param {object} settings - Settings to update
   * @returns {Promise<boolean>} Success status
   */
  async updateNotificationSettings(settings) {
    try {
      const response = await api.patch('/notifications/settings', settings);
      return response.data.success;
    } catch (error) {
      console.error('[Notifications] Failed to update settings:', error);
      return false;
    }
  }

  /**
   * Remove notification listeners
   */
  removeListeners() {
    if (this.notificationListener) {
      Notifications.removeNotificationSubscription(this.notificationListener);
    }
    if (this.responseListener) {
      Notifications.removeNotificationSubscription(this.responseListener);
    }
  }
}

export default new NotificationService();