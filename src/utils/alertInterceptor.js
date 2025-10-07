/**
 * Smart Alert Interceptor - Intelligently filters Alert.alert() calls
 *
 * This utility overrides React Native's Alert.alert to:
 * - SHOW important user-initiated alerts (logout, delete, confirmations)
 * - SUPPRESS error dialogs and technical alerts
 *
 * Allowed alerts: logout, delete, confirm, warnings
 * Suppressed alerts: errors, network issues, technical messages
 *
 * All alerts are logged to console for debugging.
 *
 * Import this file early in App.js to activate globally.
 */

import { Alert as RNAlert } from 'react-native';

// Store original Alert.alert for potential restoration
const originalAlert = RNAlert.alert;

// Track alert calls for debugging
const alertLog = [];
const MAX_LOG_SIZE = 50;

/**
 * Smart Alert - Shows important user-initiated alerts, suppresses error alerts
 * @param {string} title - Alert title
 * @param {string} message - Alert message
 * @param {Array} buttons - Alert buttons
 * @param {object} options - Alert options
 */
const silentAlert = (title, message, buttons, options) => {
  // WHITELIST: Allow important user-initiated confirmations and info
  const allowedAlerts = [
    'logout',
    'log out',
    'sign out',
    'delete',
    'remove',
    'confirm',
    'are you sure',
    'warning',
    'success',
    'updated',
    'saved',
    'help',
    'about',
    'terms',
    'privacy',
    'contact',
    'support'
  ];

  const titleLower = String(title || '').toLowerCase();
  const messageLower = String(message || '').toLowerCase();

  // Check if this is an allowed alert
  const isAllowed = allowedAlerts.some(keyword =>
    titleLower.includes(keyword) || messageLower.includes(keyword)
  );

  if (isAllowed) {
    // Show important alerts (logout, delete confirmations, etc.)
    console.log('[AlertInterceptor] Showing allowed alert:', title);
    return originalAlert(title, message, buttons, options);
  }

  // Log the suppressed alert for developers
  console.log('[AlertInterceptor] Alert suppressed:', {
    title,
    message,
    timestamp: new Date().toISOString()
  });

  // Store in log for debugging
  alertLog.push({
    title,
    message,
    timestamp: new Date().toISOString(),
    buttons: buttons?.length || 0
  });

  // Limit log size
  if (alertLog.length > MAX_LOG_SIZE) {
    alertLog.shift();
  }

  // For suppressed alerts, execute default button callback silently
  if (buttons && Array.isArray(buttons)) {
    const defaultButton = buttons.find(btn => btn.style === 'default') || buttons[0];
    if (defaultButton && typeof defaultButton.onPress === 'function') {
      try {
        defaultButton.onPress();
      } catch (error) {
        console.error('[AlertInterceptor] Button callback error:', error);
      }
    }
  }
};

/**
 * Initialize the alert interceptor
 * Call this early in app initialization
 */
export const initAlertInterceptor = () => {
  // Override Alert.alert globally
  RNAlert.alert = silentAlert;
  console.log('[AlertInterceptor] Alert.alert() has been intercepted - all alerts will be suppressed');
};

/**
 * Restore original Alert behavior (for testing)
 */
export const restoreAlert = () => {
  RNAlert.alert = originalAlert;
  console.log('[AlertInterceptor] Alert.alert() has been restored to original behavior');
};

/**
 * Get alert log for debugging
 */
export const getAlertLog = () => {
  return [...alertLog];
};

/**
 * Clear alert log
 */
export const clearAlertLog = () => {
  alertLog.length = 0;
};

/**
 * Get alert statistics
 */
export const getAlertStats = () => {
  const stats = {
    totalAlerts: alertLog.length,
    recentAlerts: alertLog.slice(-10),
    alertsByTitle: {}
  };

  alertLog.forEach(alert => {
    if (!stats.alertsByTitle[alert.title]) {
      stats.alertsByTitle[alert.title] = 0;
    }
    stats.alertsByTitle[alert.title]++;
  });

  return stats;
};

// Auto-initialize on import
initAlertInterceptor();

export default {
  init: initAlertInterceptor,
  restore: restoreAlert,
  getLog: getAlertLog,
  clearLog: clearAlertLog,
  getStats: getAlertStats
};