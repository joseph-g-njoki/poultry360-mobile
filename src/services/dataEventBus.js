/**
 * Data Event Bus
 *
 * Global event emitter for real-time data synchronization across the application.
 * Supports pub/sub pattern for data changes with automatic debouncing to prevent UI thrashing.
 *
 * Event Types:
 * - FARM_CREATED, FARM_UPDATED, FARM_DELETED
 * - BATCH_CREATED, BATCH_UPDATED, BATCH_DELETED
 * - RECORD_CREATED, RECORD_UPDATED, RECORD_DELETED (for all record types)
 * - ANALYTICS_UPDATED
 * - DATA_SYNCED (after successful sync)
 *
 * Usage:
 * // Subscribe to events
 * const unsubscribe = dataEventBus.subscribe('FARM_CREATED', (payload) => {
 *   console.log('New farm created:', payload);
 * });
 *
 * // Emit events
 * dataEventBus.emit('FARM_CREATED', { farmId: 123, farm: {...} });
 *
 * // Unsubscribe when done
 * unsubscribe();
 */

class DataEventBus {
  constructor() {
    this.listeners = {}; // { eventType: [listener1, listener2, ...] }
    this.debounceTimers = {}; // { eventType: timeoutId }
    this.defaultDebounceDelay = 500; // milliseconds
    this.eventLog = []; // For debugging
    this.maxEventLogSize = 100;
  }

  /**
   * Subscribe to a specific event type
   * @param {string} eventType - The event type to listen for
   * @param {Function} callback - Function to call when event fires
   * @returns {Function} Unsubscribe function
   */
  subscribe(eventType, callback) {
    if (!eventType || typeof callback !== 'function') {
      console.error('[DataEventBus] Invalid subscribe parameters:', { eventType, callback });
      return () => {}; // Return no-op unsubscribe
    }

    // Initialize listeners array for this event type
    if (!this.listeners[eventType]) {
      this.listeners[eventType] = [];
    }

    // Add callback to listeners
    this.listeners[eventType].push(callback);

    console.log(`[DataEventBus] Subscribed to ${eventType} (${this.listeners[eventType].length} listeners)`);

    // Return unsubscribe function
    return () => {
      this.unsubscribe(eventType, callback);
    };
  }

  /**
   * Unsubscribe from a specific event type
   * @param {string} eventType - The event type to stop listening for
   * @param {Function} callback - The callback to remove
   */
  unsubscribe(eventType, callback) {
    if (!this.listeners[eventType]) {
      return;
    }

    this.listeners[eventType] = this.listeners[eventType].filter(cb => cb !== callback);

    console.log(`[DataEventBus] Unsubscribed from ${eventType} (${this.listeners[eventType].length} listeners remaining)`);

    // Clean up empty listener arrays
    if (this.listeners[eventType].length === 0) {
      delete this.listeners[eventType];
    }
  }

  /**
   * Emit an event to all subscribers
   * @param {string} eventType - The event type to emit
   * @param {Object} payload - Data to pass to listeners
   * @param {Object} options - Emission options { debounce: true/false, delay: number }
   */
  emit(eventType, payload = {}, options = {}) {
    const {
      debounce = true,
      delay = this.defaultDebounceDelay
    } = options;

    // Log event for debugging
    this.logEvent(eventType, payload);

    // Emit immediately if debounce is disabled
    if (!debounce) {
      this._emitImmediate(eventType, payload);
      return;
    }

    // Debounced emission - prevents rapid-fire events from thrashing UI
    if (this.debounceTimers[eventType]) {
      clearTimeout(this.debounceTimers[eventType]);
    }

    this.debounceTimers[eventType] = setTimeout(() => {
      this._emitImmediate(eventType, payload);
      delete this.debounceTimers[eventType];
    }, delay);
  }

  /**
   * Emit event immediately without debouncing (internal)
   * @private
   */
  _emitImmediate(eventType, payload) {
    const listeners = this.listeners[eventType] || [];

    if (listeners.length === 0) {
      console.log(`[DataEventBus] No listeners for ${eventType}`);
      return;
    }

    console.log(`[DataEventBus] Emitting ${eventType} to ${listeners.length} listener(s)`, payload);

    // Call all listeners with error handling
    listeners.forEach((callback, index) => {
      try {
        callback(payload);
      } catch (error) {
        console.error(`[DataEventBus] Error in listener ${index} for ${eventType}:`, error);
      }
    });
  }

  /**
   * Subscribe to multiple event types with one callback
   * @param {Array<string>} eventTypes - Array of event types
   * @param {Function} callback - Function to call when any event fires
   * @returns {Function} Unsubscribe function that removes all subscriptions
   */
  subscribeMultiple(eventTypes, callback) {
    const unsubscribers = eventTypes.map(eventType =>
      this.subscribe(eventType, callback)
    );

    // Return function that unsubscribes from all
    return () => {
      unsubscribers.forEach(unsub => unsub());
    };
  }

  /**
   * Emit multiple events at once (useful for batch operations)
   * @param {Array<{eventType: string, payload: Object}>} events
   */
  emitBatch(events, options = {}) {
    events.forEach(({ eventType, payload }) => {
      this.emit(eventType, payload, options);
    });
  }

  /**
   * Log event for debugging
   * @private
   */
  logEvent(eventType, payload) {
    const timestamp = new Date().toISOString();
    this.eventLog.push({
      timestamp,
      eventType,
      payload: this._sanitizePayload(payload)
    });

    // Keep log size under control
    if (this.eventLog.length > this.maxEventLogSize) {
      this.eventLog.shift();
    }
  }

  /**
   * Sanitize payload to prevent huge objects in logs
   * @private
   */
  _sanitizePayload(payload) {
    try {
      const str = JSON.stringify(payload);
      if (str.length > 500) {
        return JSON.parse(str.substring(0, 500) + '...');
      }
      return payload;
    } catch {
      return { error: 'Could not serialize payload' };
    }
  }

  /**
   * Get event log for debugging
   * @param {number} limit - Number of recent events to return
   * @returns {Array} Recent events
   */
  getEventLog(limit = 20) {
    return this.eventLog.slice(-limit);
  }

  /**
   * Clear all listeners (useful for testing)
   */
  clear() {
    console.log('[DataEventBus] Clearing all listeners');
    this.listeners = {};
    this.debounceTimers = {};
    Object.values(this.debounceTimers).forEach(timerId => clearTimeout(timerId));
  }

  /**
   * Get current listener count for debugging
   * @returns {Object} Listener counts by event type
   */
  getListenerCounts() {
    const counts = {};
    Object.keys(this.listeners).forEach(eventType => {
      counts[eventType] = this.listeners[eventType].length;
    });
    return counts;
  }

  /**
   * Check if any listeners are subscribed to an event
   * @param {string} eventType
   * @returns {boolean}
   */
  hasListeners(eventType) {
    return !!(this.listeners[eventType] && this.listeners[eventType].length > 0);
  }
}

// Export singleton instance
const dataEventBus = new DataEventBus();

// Define event type constants for type safety and autocomplete
export const EventTypes = {
  // Farm events
  FARM_CREATED: 'FARM_CREATED',
  FARM_UPDATED: 'FARM_UPDATED',
  FARM_DELETED: 'FARM_DELETED',

  // Batch events
  BATCH_CREATED: 'BATCH_CREATED',
  BATCH_UPDATED: 'BATCH_UPDATED',
  BATCH_DELETED: 'BATCH_DELETED',

  // Feed record events
  FEED_RECORD_CREATED: 'FEED_RECORD_CREATED',
  FEED_RECORD_UPDATED: 'FEED_RECORD_UPDATED',
  FEED_RECORD_DELETED: 'FEED_RECORD_DELETED',

  // Production record events
  PRODUCTION_RECORD_CREATED: 'PRODUCTION_RECORD_CREATED',
  PRODUCTION_RECORD_UPDATED: 'PRODUCTION_RECORD_UPDATED',
  PRODUCTION_RECORD_DELETED: 'PRODUCTION_RECORD_DELETED',

  // Mortality record events
  MORTALITY_RECORD_CREATED: 'MORTALITY_RECORD_CREATED',
  MORTALITY_RECORD_UPDATED: 'MORTALITY_RECORD_UPDATED',
  MORTALITY_RECORD_DELETED: 'MORTALITY_RECORD_DELETED',

  // Health record events
  HEALTH_RECORD_CREATED: 'HEALTH_RECORD_CREATED',
  HEALTH_RECORD_UPDATED: 'HEALTH_RECORD_UPDATED',
  HEALTH_RECORD_DELETED: 'HEALTH_RECORD_DELETED',

  // Water record events
  WATER_RECORD_CREATED: 'WATER_RECORD_CREATED',
  WATER_RECORD_UPDATED: 'WATER_RECORD_UPDATED',
  WATER_RECORD_DELETED: 'WATER_RECORD_DELETED',

  // Weight record events
  WEIGHT_RECORD_CREATED: 'WEIGHT_RECORD_CREATED',
  WEIGHT_RECORD_UPDATED: 'WEIGHT_RECORD_UPDATED',
  WEIGHT_RECORD_DELETED: 'WEIGHT_RECORD_DELETED',

  // Vaccination record events
  VACCINATION_RECORD_CREATED: 'VACCINATION_RECORD_CREATED',
  VACCINATION_RECORD_UPDATED: 'VACCINATION_RECORD_UPDATED',
  VACCINATION_RECORD_DELETED: 'VACCINATION_RECORD_DELETED',

  // Generic record event (when record type doesn't matter)
  RECORD_CREATED: 'RECORD_CREATED',
  RECORD_UPDATED: 'RECORD_UPDATED',
  RECORD_DELETED: 'RECORD_DELETED',

  // Analytics events
  ANALYTICS_UPDATED: 'ANALYTICS_UPDATED',

  // Sync events
  DATA_SYNCED: 'DATA_SYNCED',
  SYNC_STARTED: 'SYNC_STARTED',
  SYNC_COMPLETED: 'SYNC_COMPLETED',
  SYNC_FAILED: 'SYNC_FAILED',

  // Financial events (for sales, expenses, customers)
  SALE_CREATED: 'SALE_CREATED',
  SALE_UPDATED: 'SALE_UPDATED',
  SALE_DELETED: 'SALE_DELETED',

  EXPENSE_CREATED: 'EXPENSE_CREATED',
  EXPENSE_UPDATED: 'EXPENSE_UPDATED',
  EXPENSE_DELETED: 'EXPENSE_DELETED',

  CUSTOMER_CREATED: 'CUSTOMER_CREATED',
  CUSTOMER_UPDATED: 'CUSTOMER_UPDATED',
  CUSTOMER_DELETED: 'CUSTOMER_DELETED'
};

export default dataEventBus;
