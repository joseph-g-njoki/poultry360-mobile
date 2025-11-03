import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import ENV from '../config/environment';

// Configure notification behavior
// This handler controls how notifications are displayed when they TRIGGER (at their scheduled time)
Notifications.setNotificationHandler({
  handleNotification: async (notification) => {
    console.log('[Notifications] 📬 Notification triggered at scheduled time:', notification.request.content.title);

    return {
      // Use new API to avoid deprecation warning
      shouldShowBanner: true,  // Show notification banner at top
      shouldShowList: true,    // Show in notification list/tray
      shouldPlaySound: true,   // Play notification sound
      shouldSetBadge: true,    // Update app badge count
    };
  },
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

      // Get auth token for API request
      const authToken = await AsyncStorage.getItem('authToken');

      const response = await axios.post(
        `${ENV.apiUrl}/notifications/register-device`,
        {
          expoPushToken: token,
          deviceId,
          platform,
        },
        {
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
          },
          timeout: 10000
        }
      );

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
      const authToken = await AsyncStorage.getItem('authToken');
      const response = await axios.get(
        `${ENV.apiUrl}/notifications/settings`,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
          },
          timeout: 10000
        }
      );
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
      const authToken = await AsyncStorage.getItem('authToken');
      const response = await axios.patch(
        `${ENV.apiUrl}/notifications/settings`,
        settings,
        {
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
          },
          timeout: 10000
        }
      );
      return response.data.success;
    } catch (error) {
      console.error('[Notifications] Failed to update settings:', error);
      return false;
    }
  }

  /**
   * Schedule vaccination reminders
   * Sends TWO notifications:
   * 1. Day before at 8 AM - "Reminder: vaccination tomorrow"
   * 2. On vaccination day at exact time - "Time to vaccinate NOW"
   * @param {object} vaccination - Vaccination record { vaccinationType, vaccinationDate, vaccinationTime, batchId }
   * @returns {Promise<Array>} Array of notification IDs
   */
  async scheduleVaccinationReminder(vaccination) {
    // IMPORTANT: Vaccination reminders are now handled by the BACKEND server
    // The backend sends reminders at EXACT scheduled times:
    // - Day before at SAME TIME as vaccination
    // - On the day at EXACT vaccination time
    console.log('[Notifications] ℹ️ Vaccination reminders are handled by backend server');
    console.log('[Notifications] ℹ️ Backend sends hourly checks for scheduled vaccinations');
    return [];

    // OLD CODE (DISABLED - Backend handles this now):
    // try {
    //   const { vaccinationType, vaccinationDate, vaccinationTime = '08:00' } = vaccination;
    //   const notificationIds = [];
    //
    //   // Validate input
    //   if (!vaccinationDate || !vaccinationType) {
    //     console.log('[Notifications] ❌ Missing vaccination date or type');
    //     return [];
    //   }
    //
    //   // Parse vaccination date and time
    //   const [year, month, day] = vaccinationDate.split('-').map(Number);
    //   const [hours, minutes] = vaccinationTime.split(':').map(Number);
    //
    //   // Validate parsed values
    //   if (isNaN(year) || isNaN(month) || isNaN(day) || isNaN(hours) || isNaN(minutes)) {
    //     console.log('[Notifications] ❌ Invalid date/time format:', { vaccinationDate, vaccinationTime });
    //     return [];
    //   }
    //
    //   // Create vaccination datetime
    //   const vaccinationDateTime = new Date(year, month - 1, day, hours, minutes);
    //   const now = new Date();
    //
    //   console.log('[Notifications] 📅 Vaccination Details:');
    //   console.log('  - Type:', vaccinationType);
    //   console.log('  - Date:', vaccinationDate);
    //   console.log('  - Time:', vaccinationTime);
    //   console.log('  - Parsed DateTime:', vaccinationDateTime.toLocaleString());
    //   console.log('  - Current DateTime:', now.toLocaleString());
    //   console.log('  - Is Future?', vaccinationDateTime > now);
    //
    //   // Check if vaccination is in the future
    //   if (vaccinationDateTime <= now) {
    //     console.log('[Notifications] ❌ Vaccination time is in the past or present. No reminders scheduled.');
    //     return [];
    //   }
    //
    //   // REMINDER 1: Day before at SAME TIME as vaccination
    //   const dayBeforeReminder = new Date(vaccinationDateTime);
    //   dayBeforeReminder.setDate(dayBeforeReminder.getDate() - 1);
    //   // Keep the same hours and minutes as vaccination time (don't change to 8 AM)
    //
    //   const secondsUntilDayBefore = Math.floor((dayBeforeReminder - now) / 1000);
    //
    //   console.log('[Notifications] 📆 Day-Before Reminder:');
    //   console.log('  - Target Time:', dayBeforeReminder.toLocaleString());
    //   console.log('  - Seconds Until:', secondsUntilDayBefore);
    //   console.log('  - Hours Until:', (secondsUntilDayBefore / 3600).toFixed(2));
    //   console.log('  - Will Schedule?', dayBeforeReminder > now && secondsUntilDayBefore >= 300);
    //
    //   // Minimum 5 minutes (300 seconds) in the future to prevent immediate firing
    //   if (dayBeforeReminder > now && secondsUntilDayBefore >= 300) {
    //     console.log('[Notifications] 🔔 SCHEDULING day-before reminder NOW...');
    //     console.log('[Notifications] ⏰ This notification will NOT appear until:', dayBeforeReminder.toLocaleString());
    //     console.log('[Notifications] ⏰ Which is in', (secondsUntilDayBefore / 3600).toFixed(2), 'hours from now');
    //
    //     const id1 = await Notifications.scheduleNotificationAsync({
    //       content: {
    //         title: '💉 Vaccination Reminder - Tomorrow',
    //         body: `Prepare for ${vaccinationType} vaccination tomorrow at ${vaccinationTime}`,
    //         data: { type: 'vaccination_reminder_day_before', vaccination },
    //         sound: true,
    //         priority: Notifications.AndroidNotificationPriority.HIGH,
    //       },
    //       trigger: { seconds: secondsUntilDayBefore },
    //     });
    //     notificationIds.push(id1);
    //     console.log('[Notifications] ✅ Day-before reminder SCHEDULED (not shown yet!) with ID:', id1);
    //     console.log('[Notifications] 📅 It will appear at:', dayBeforeReminder.toLocaleString());
    //   } else {
    //     console.log('[Notifications] ⏭️  Day-before reminder skipped (time already passed or less than 5 minutes away)');
    //   }
    //
    //   // REMINDER 2: On vaccination day at exact time
    //   const secondsUntilVaccination = Math.floor((vaccinationDateTime - now) / 1000);
    //
    //   console.log('[Notifications] 📆 Exact-Time Reminder:');
    //   console.log('  - Target Time:', vaccinationDateTime.toLocaleString());
    //   console.log('  - Seconds Until:', secondsUntilVaccination);
    //   console.log('  - Hours Until:', (secondsUntilVaccination / 3600).toFixed(2));
    //   console.log('  - Will Schedule?', vaccinationDateTime > now && secondsUntilVaccination >= 300);
    //
    //   // Minimum 5 minutes (300 seconds) in the future to prevent immediate firing
    //   if (vaccinationDateTime > now && secondsUntilVaccination >= 300) {
    //     console.log('[Notifications] 🔔 SCHEDULING exact-time reminder NOW...');
    //     console.log('[Notifications] ⏰ This notification will NOT appear until:', vaccinationDateTime.toLocaleString());
    //     console.log('[Notifications] ⏰ Which is in', (secondsUntilVaccination / 3600).toFixed(2), 'hours from now');
    //
    //     const id2 = await Notifications.scheduleNotificationAsync({
    //       content: {
    //         title: '💉 Vaccination Time NOW!',
    //         body: `It's time to administer ${vaccinationType} vaccination`,
    //         data: { type: 'vaccination_now', vaccination },
    //         sound: true,
    //         priority: Notifications.AndroidNotificationPriority.MAX,
    //       },
    //       trigger: { seconds: secondsUntilVaccination },
    //     });
    //     notificationIds.push(id2);
    //     console.log('[Notifications] ✅ Exact-time reminder SCHEDULED (not shown yet!) with ID:', id2);
    //     console.log('[Notifications] 📅 It will appear at:', vaccinationDateTime.toLocaleString());
    //   } else {
    //     console.log('[Notifications] ⏭️  Exact-time reminder skipped (time already passed or less than 5 minutes away)');
    //   }
    //
    //   console.log(`[Notifications] ✅ TOTAL: Scheduled ${notificationIds.length} vaccination reminder(s)`);
    //   return notificationIds;
    // } catch (error) {
    //   console.error('[Notifications] ❌ ERROR scheduling vaccination reminders:', error);
    //   return [];
    // }
  }

  /**
   * Schedule daily reminder at 6 PM for recording farm activities
   * @returns {Promise<string|null>} Notification ID or null
   */
  async scheduleDailyReminders() {
    // IMPORTANT: Daily reminders are now handled by the BACKEND server
    // The backend checks if records have been created before sending reminders at 6 PM
    // This prevents duplicate reminders and ensures proper logic
    console.log('[Notifications] ℹ️ Daily reminders are handled by backend server');
    console.log('[Notifications] ℹ️ Backend sends reminders at 6:00 PM ONLY if no records were created today');
    return null;

    // OLD CODE (DISABLED - Backend handles this now):
    // try {
    //   const now = new Date();
    //   const reminderTime = new Date();
    //   reminderTime.setHours(18, 0, 0, 0); // 6 PM
    //
    //   // If 6 PM has passed today, schedule for tomorrow
    //   if (now >= reminderTime) {
    //     reminderTime.setDate(reminderTime.getDate() + 1);
    //   }
    //
    //   const secondsUntilReminder = Math.floor((reminderTime - now) / 1000);
    //
    //   console.log('[Notifications] 📅 Daily Reminder Details:');
    //   console.log('  - Current Time:', now.toLocaleString());
    //   console.log('  - Target Time:', reminderTime.toLocaleString());
    //   console.log('  - Seconds Until:', secondsUntilReminder);
    //   console.log('  - Hours Until:', (secondsUntilReminder / 3600).toFixed(2));
    //   console.log('  - Will Schedule?', secondsUntilReminder >= 300);
    //
    //   // Minimum 5 minutes (300 seconds) in the future to prevent immediate firing
    //   if (secondsUntilReminder >= 300) {
    //     console.log('[Notifications] 🔔 SCHEDULING daily 6 PM reminder NOW...');
    //     console.log('[Notifications] ⏰ This notification will NOT appear until:', reminderTime.toLocaleString());
    //     console.log('[Notifications] ⏰ Which is in', (secondsUntilReminder / 3600).toFixed(2), 'hours from now');
    //
    //     const id = await Notifications.scheduleNotificationAsync({
    //       content: {
    //         title: '📝 Daily Farm Records Reminder',
    //         body: 'Time to record today\'s farm activities (feeding, production, health checks)',
    //         data: { type: 'daily_reminder', hour: 18 },
    //         sound: true,
    //         priority: Notifications.AndroidNotificationPriority.DEFAULT,
    //       },
    //       trigger: { seconds: secondsUntilReminder },
    //     });
    //
    //     console.log('[Notifications] ✅ Daily reminder SCHEDULED (not shown yet!) with ID:', id);
    //     console.log('[Notifications] 📅 It will appear at:', reminderTime.toLocaleString());
    //     return id;
    //   } else {
    //     console.log('[Notifications] ⏭️ Daily reminder skipped (less than 5 minutes away)');
    //     return null;
    //   }
    // } catch (error) {
    //   console.error('[Notifications] ❌ ERROR scheduling daily reminder:', error);
    //   return null;
    // }
  }

  /**
   * Legacy method for backward compatibility
   * @deprecated Use scheduleDailyReminders() instead
   */
  async scheduleDailyReminder() {
    return this.scheduleDailyReminders();
  }

  /**
   * Cancel all scheduled notifications
   */
  async cancelAllNotifications() {
    try {
      await Notifications.cancelAllScheduledNotificationsAsync();
      console.log('[Notifications] All scheduled notifications cancelled');
    } catch (error) {
      console.error('[Notifications] Failed to cancel notifications:', error);
    }
  }

  /**
   * Get all scheduled notifications
   * @returns {Promise<Array>} Array of scheduled notifications
   */
  async getAllScheduledNotifications() {
    try {
      const notifications = await Notifications.getAllScheduledNotificationsAsync();
      console.log('[Notifications] Scheduled notifications:', notifications.length);
      return notifications;
    } catch (error) {
      console.error('[Notifications] Failed to get scheduled notifications:', error);
      return [];
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