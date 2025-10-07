import crashLogger from './crashLogger';

/**
 * Memory Leak Detection and Prevention Utility
 * Helps identify and prevent common React Native memory leaks
 */
class MemoryLeakDetector {
  constructor() {
    this.timers = new Map();
    this.intervals = new Map();
    this.listeners = new Map();
    this.subscriptions = new Map();
    this.activeComponents = new Set();
    this.warningThreshold = 100; // Warn if > 100 active timers/listeners
  }

  // Track component mounting
  registerComponent(componentName) {
    this.activeComponents.add(componentName);
    console.log(`[MemoryLeakDetector] Registered: ${componentName} (Total: ${this.activeComponents.size})`);
  }

  // Track component unmounting
  unregisterComponent(componentName) {
    this.activeComponents.delete(componentName);
    console.log(`[MemoryLeakDetector] Unregistered: ${componentName} (Total: ${this.activeComponents.size})`);
  }

  // Track setTimeout
  trackTimeout(componentName, timeoutId, callback, delay) {
    const key = `${componentName}-${timeoutId}`;
    this.timers.set(key, {
      componentName,
      timeoutId,
      createdAt: Date.now(),
      delay,
    });

    if (this.timers.size > this.warningThreshold) {
      this.logWarning('Too many active timers', { count: this.timers.size });
    }

    return timeoutId;
  }

  // Clear tracked timeout
  clearTimeout(componentName, timeoutId) {
    const key = `${componentName}-${timeoutId}`;
    this.timers.delete(key);
    clearTimeout(timeoutId);
  }

  // Track setInterval
  trackInterval(componentName, intervalId, callback, delay) {
    const key = `${componentName}-${intervalId}`;
    this.intervals.set(key, {
      componentName,
      intervalId,
      createdAt: Date.now(),
      delay,
    });

    if (this.intervals.size > this.warningThreshold) {
      this.logWarning('Too many active intervals', { count: this.intervals.size });
    }

    return intervalId;
  }

  // Clear tracked interval
  clearInterval(componentName, intervalId) {
    const key = `${componentName}-${intervalId}`;
    this.intervals.delete(key);
    clearInterval(intervalId);
  }

  // Track event listeners
  trackListener(componentName, eventName, callback) {
    const key = `${componentName}-${eventName}`;
    if (!this.listeners.has(key)) {
      this.listeners.set(key, []);
    }
    this.listeners.get(key).push({
      callback,
      createdAt: Date.now(),
    });

    if (this.getTotalListeners() > this.warningThreshold) {
      this.logWarning('Too many active listeners', { count: this.getTotalListeners() });
    }
  }

  // Remove tracked listener
  removeListener(componentName, eventName) {
    const key = `${componentName}-${eventName}`;
    this.listeners.delete(key);
  }

  // Track subscriptions (e.g., navigation, network status)
  trackSubscription(componentName, subscriptionName, unsubscribe) {
    const key = `${componentName}-${subscriptionName}`;
    this.subscriptions.set(key, {
      componentName,
      subscriptionName,
      unsubscribe,
      createdAt: Date.now(),
    });

    if (this.subscriptions.size > this.warningThreshold) {
      this.logWarning('Too many active subscriptions', { count: this.subscriptions.size });
    }
  }

  // Unsubscribe and remove tracked subscription
  unsubscribe(componentName, subscriptionName) {
    const key = `${componentName}-${subscriptionName}`;
    const subscription = this.subscriptions.get(key);
    if (subscription && typeof subscription.unsubscribe === 'function') {
      subscription.unsubscribe();
    }
    this.subscriptions.delete(key);
  }

  // Clean up all resources for a component
  cleanupComponent(componentName) {
    let cleaned = 0;

    // Clear all timers for this component
    for (const [key, timer] of this.timers.entries()) {
      if (timer.componentName === componentName) {
        clearTimeout(timer.timeoutId);
        this.timers.delete(key);
        cleaned++;
      }
    }

    // Clear all intervals for this component
    for (const [key, interval] of this.intervals.entries()) {
      if (interval.componentName === componentName) {
        clearInterval(interval.intervalId);
        this.intervals.delete(key);
        cleaned++;
      }
    }

    // Remove all listeners for this component
    for (const [key] of this.listeners.entries()) {
      if (key.startsWith(`${componentName}-`)) {
        this.listeners.delete(key);
        cleaned++;
      }
    }

    // Unsubscribe all subscriptions for this component
    for (const [key, subscription] of this.subscriptions.entries()) {
      if (subscription.componentName === componentName) {
        if (typeof subscription.unsubscribe === 'function') {
          subscription.unsubscribe();
        }
        this.subscriptions.delete(key);
        cleaned++;
      }
    }

    if (cleaned > 0) {
      console.log(`[MemoryLeakDetector] Cleaned up ${cleaned} resources for ${componentName}`);
    }

    this.unregisterComponent(componentName);
  }

  // Get total number of active listeners
  getTotalListeners() {
    let total = 0;
    for (const listeners of this.listeners.values()) {
      total += listeners.length;
    }
    return total;
  }

  // Get memory leak report
  getReport() {
    const report = {
      activeComponents: this.activeComponents.size,
      activeTimers: this.timers.size,
      activeIntervals: this.intervals.size,
      activeListeners: this.getTotalListeners(),
      activeSubscriptions: this.subscriptions.size,
      componentsList: Array.from(this.activeComponents),
      longRunningTimers: [],
      longRunningIntervals: [],
    };

    const now = Date.now();
    const oneMinute = 60 * 1000;

    // Find long-running timers (> 1 minute)
    for (const timer of this.timers.values()) {
      if (now - timer.createdAt > oneMinute) {
        report.longRunningTimers.push({
          componentName: timer.componentName,
          ageInSeconds: Math.floor((now - timer.createdAt) / 1000),
        });
      }
    }

    // Find long-running intervals
    for (const interval of this.intervals.values()) {
      if (now - interval.createdAt > oneMinute) {
        report.longRunningIntervals.push({
          componentName: interval.componentName,
          ageInSeconds: Math.floor((now - interval.createdAt) / 1000),
        });
      }
    }

    return report;
  }

  // Log warning for potential memory leaks
  async logWarning(message, data) {
    console.warn(`[MemoryLeakDetector] WARNING: ${message}`, data);
    await crashLogger.logError('Memory Leak Warning', new Error(message), data);
  }

  // Periodic check for memory leaks
  startPeriodicCheck(intervalMs = 60000) {
    this.checkInterval = setInterval(() => {
      const report = this.getReport();

      if (report.activeTimers > this.warningThreshold ||
          report.activeIntervals > this.warningThreshold ||
          report.activeListeners > this.warningThreshold ||
          report.activeSubscriptions > this.warningThreshold) {
        this.logWarning('Possible memory leak detected', report);
      }

      if (report.longRunningTimers.length > 0 || report.longRunningIntervals.length > 0) {
        console.warn('[MemoryLeakDetector] Long-running timers/intervals detected:', {
          timers: report.longRunningTimers,
          intervals: report.longRunningIntervals,
        });
      }
    }, intervalMs);
  }

  // Stop periodic check
  stopPeriodicCheck() {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  // Helper hook for components to automatically cleanup
  useComponentCleanup(componentName) {
    return () => {
      this.cleanupComponent(componentName);
    };
  }
}

// Export singleton instance
const memoryLeakDetector = new MemoryLeakDetector();

// Start periodic checks
if (__DEV__) {
  memoryLeakDetector.startPeriodicCheck(60000); // Check every minute in dev mode
}

export default memoryLeakDetector;
