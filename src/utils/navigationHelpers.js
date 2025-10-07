/**
 * SAFE NAVIGATION HELPERS
 *
 * This file contains safe navigation utilities to prevent crashes
 * from undefined navigation objects, invalid routes, or missing parameters.
 */

/**
 * Safely navigate to a screen
 * @param {any} navigation - Navigation object from React Navigation
 * @param {string} screen - Screen name to navigate to
 * @param {Object} params - Optional navigation parameters
 * @returns {boolean} True if navigation succeeded, false otherwise
 */
export const safeNavigate = (navigation, screen, params = {}) => {
  try {
    if (!navigation) {
      console.warn('safeNavigate: Navigation object not available');
      return false;
    }

    if (!screen || typeof screen !== 'string') {
      console.warn('safeNavigate: Invalid screen name', screen);
      return false;
    }

    if (typeof navigation.navigate !== 'function') {
      console.warn('safeNavigate: Navigation.navigate is not a function');
      return false;
    }

    navigation.navigate(screen, params);
    return true;
  } catch (error) {
    console.error('safeNavigate: Navigation error', error);
    return false;
  }
};

/**
 * Safely go back in navigation
 * @param {any} navigation - Navigation object from React Navigation
 * @returns {boolean} True if navigation succeeded, false otherwise
 */
export const safeGoBack = (navigation) => {
  try {
    if (!navigation) {
      console.warn('safeGoBack: Navigation object not available');
      return false;
    }

    if (typeof navigation.goBack !== 'function') {
      console.warn('safeGoBack: Navigation.goBack is not a function');
      return false;
    }

    // Check if we can go back
    if (navigation.canGoBack && typeof navigation.canGoBack === 'function') {
      if (!navigation.canGoBack()) {
        console.warn('safeGoBack: Cannot go back, no screen in history');
        return false;
      }
    }

    navigation.goBack();
    return true;
  } catch (error) {
    console.error('safeGoBack: Navigation error', error);
    return false;
  }
};

/**
 * Safely get route parameter
 * @param {any} route - Route object from React Navigation
 * @param {string} paramName - Parameter name to retrieve
 * @param {any} fallback - Default value if parameter not found
 * @returns {any} Parameter value or fallback
 */
export const safeGetParam = (route, paramName, fallback = null) => {
  try {
    if (!route) {
      console.warn('safeGetParam: Route object not available');
      return fallback;
    }

    if (!paramName || typeof paramName !== 'string') {
      console.warn('safeGetParam: Invalid parameter name', paramName);
      return fallback;
    }

    if (!route.params || typeof route.params !== 'object') {
      console.warn('safeGetParam: Route params not available');
      return fallback;
    }

    const value = route.params[paramName];
    return value !== undefined ? value : fallback;
  } catch (error) {
    console.error('safeGetParam: Error getting parameter', error);
    return fallback;
  }
};

/**
 * Safely set route params
 * @param {any} navigation - Navigation object from React Navigation
 * @param {Object} params - Parameters to set
 * @returns {boolean} True if params were set, false otherwise
 */
export const safeSetParams = (navigation, params) => {
  try {
    if (!navigation) {
      console.warn('safeSetParams: Navigation object not available');
      return false;
    }

    if (!params || typeof params !== 'object') {
      console.warn('safeSetParams: Invalid params object', params);
      return false;
    }

    if (typeof navigation.setParams !== 'function') {
      console.warn('safeSetParams: Navigation.setParams is not a function');
      return false;
    }

    navigation.setParams(params);
    return true;
  } catch (error) {
    console.error('safeSetParams: Error setting parameters', error);
    return false;
  }
};

/**
 * Safely replace current screen
 * @param {any} navigation - Navigation object from React Navigation
 * @param {string} screen - Screen name to replace with
 * @param {Object} params - Optional navigation parameters
 * @returns {boolean} True if navigation succeeded, false otherwise
 */
export const safeReplace = (navigation, screen, params = {}) => {
  try {
    if (!navigation) {
      console.warn('safeReplace: Navigation object not available');
      return false;
    }

    if (!screen || typeof screen !== 'string') {
      console.warn('safeReplace: Invalid screen name', screen);
      return false;
    }

    if (typeof navigation.replace !== 'function') {
      console.warn('safeReplace: Navigation.replace is not a function');
      return false;
    }

    navigation.replace(screen, params);
    return true;
  } catch (error) {
    console.error('safeReplace: Navigation error', error);
    return false;
  }
};

/**
 * Safely reset navigation stack
 * @param {any} navigation - Navigation object from React Navigation
 * @param {Object} resetConfig - Reset configuration
 * @returns {boolean} True if reset succeeded, false otherwise
 */
export const safeReset = (navigation, resetConfig) => {
  try {
    if (!navigation) {
      console.warn('safeReset: Navigation object not available');
      return false;
    }

    if (!resetConfig || typeof resetConfig !== 'object') {
      console.warn('safeReset: Invalid reset config', resetConfig);
      return false;
    }

    if (typeof navigation.reset !== 'function') {
      console.warn('safeReset: Navigation.reset is not a function');
      return false;
    }

    navigation.reset(resetConfig);
    return true;
  } catch (error) {
    console.error('safeReset: Navigation error', error);
    return false;
  }
};

/**
 * Safely check if can go back
 * @param {any} navigation - Navigation object from React Navigation
 * @returns {boolean} True if can go back, false otherwise
 */
export const safeCanGoBack = (navigation) => {
  try {
    if (!navigation) {
      return false;
    }

    if (typeof navigation.canGoBack === 'function') {
      return navigation.canGoBack();
    }

    console.warn('safeCanGoBack: Navigation.canGoBack is not a function');
    return false;
  } catch (error) {
    console.error('safeCanGoBack: Error checking navigation', error);
    return false;
  }
};

/**
 * Safely get current route name
 * @param {any} navigation - Navigation object from React Navigation
 * @returns {string|null} Current route name or null
 */
export const safeGetCurrentRoute = (navigation) => {
  try {
    if (!navigation) {
      console.warn('safeGetCurrentRoute: Navigation object not available');
      return null;
    }

    if (typeof navigation.getCurrentRoute === 'function') {
      const route = navigation.getCurrentRoute();
      return route?.name || null;
    }

    // Fallback for older navigation versions
    const state = navigation.getState && navigation.getState();
    if (state && state.routes && Array.isArray(state.routes)) {
      const currentRoute = state.routes[state.index];
      return currentRoute?.name || null;
    }

    console.warn('safeGetCurrentRoute: Cannot determine current route');
    return null;
  } catch (error) {
    console.error('safeGetCurrentRoute: Error getting current route', error);
    return null;
  }
};

/**
 * Safely dispatch navigation action
 * @param {any} navigation - Navigation object from React Navigation
 * @param {Object} action - Navigation action to dispatch
 * @returns {boolean} True if dispatch succeeded, false otherwise
 */
export const safeDispatch = (navigation, action) => {
  try {
    if (!navigation) {
      console.warn('safeDispatch: Navigation object not available');
      return false;
    }

    if (!action || typeof action !== 'object') {
      console.warn('safeDispatch: Invalid action object', action);
      return false;
    }

    if (typeof navigation.dispatch !== 'function') {
      console.warn('safeDispatch: Navigation.dispatch is not a function');
      return false;
    }

    navigation.dispatch(action);
    return true;
  } catch (error) {
    console.error('safeDispatch: Navigation error', error);
    return false;
  }
};

/**
 * Safely add navigation listener
 * @param {any} navigation - Navigation object from React Navigation
 * @param {string} event - Event name to listen to
 * @param {Function} callback - Callback function
 * @returns {Function|null} Unsubscribe function or null
 */
export const safeAddListener = (navigation, event, callback) => {
  try {
    if (!navigation) {
      console.warn('safeAddListener: Navigation object not available');
      return null;
    }

    if (!event || typeof event !== 'string') {
      console.warn('safeAddListener: Invalid event name', event);
      return null;
    }

    if (typeof callback !== 'function') {
      console.warn('safeAddListener: Invalid callback function');
      return null;
    }

    if (typeof navigation.addListener !== 'function') {
      console.warn('safeAddListener: Navigation.addListener is not a function');
      return null;
    }

    return navigation.addListener(event, callback);
  } catch (error) {
    console.error('safeAddListener: Error adding listener', error);
    return null;
  }
};

/**
 * Safely remove navigation listener
 * @param {Function} unsubscribe - Unsubscribe function returned by addListener
 * @returns {boolean} True if removed successfully, false otherwise
 */
export const safeRemoveListener = (unsubscribe) => {
  try {
    if (!unsubscribe || typeof unsubscribe !== 'function') {
      console.warn('safeRemoveListener: Invalid unsubscribe function');
      return false;
    }

    unsubscribe();
    return true;
  } catch (error) {
    console.error('safeRemoveListener: Error removing listener', error);
    return false;
  }
};

// Export all helpers as default object
export default {
  safeNavigate,
  safeGoBack,
  safeGetParam,
  safeSetParams,
  safeReplace,
  safeReset,
  safeCanGoBack,
  safeGetCurrentRoute,
  safeDispatch,
  safeAddListener,
  safeRemoveListener
};