/**
 * Circuit Breaker Pattern Implementation
 * Prevents cascading failures and infinite retry loops
 *
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Too many failures, requests fail immediately
 * - HALF_OPEN: Testing if service recovered
 */

class CircuitBreaker {
  constructor(options = {}) {
    this.threshold = options.threshold || 5; // Failures before opening
    this.cooldown = options.cooldown || 60000; // 1 minute cooldown
    this.timeout = options.timeout || 30000; // 30 second timeout
    this.name = options.name || 'CircuitBreaker';

    // State tracking
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.lastFailTime = 0;
    this.lastStateChange = Date.now();

    // Statistics
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
  }

  /**
   * Execute operation with circuit breaker protection
   * @param {function} operation - Async operation to execute
   * @returns {Promise<any>} - Operation result
   */
  async execute(operation) {
    this.totalRequests++;

    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        console.log(`🟡 [${this.name}] Attempting reset (HALF_OPEN)...`);
        this.state = 'HALF_OPEN';
      } else {
        const remainingTime = this.cooldown - (Date.now() - this.lastFailTime);
        throw new Error(
          `Circuit breaker is OPEN. Retry in ${Math.ceil(remainingTime / 1000)}s`
        );
      }
    }

    try {
      // Execute with timeout
      const result = await this.executeWithTimeout(operation);

      // Success - record it
      this.onSuccess();
      return result;
    } catch (error) {
      // Failure - record it
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute operation with timeout
   * @param {function} operation - Operation to execute
   * @returns {Promise<any>} - Result or timeout error
   */
  async executeWithTimeout(operation) {
    return Promise.race([
      operation(),
      new Promise((_, reject) =>
        setTimeout(
          () => reject(new Error(`Operation timeout (${this.timeout}ms)`)),
          this.timeout
        )
      )
    ]);
  }

  /**
   * Handle successful operation
   */
  onSuccess() {
    this.failures = 0;
    this.successes++;
    this.totalSuccesses++;

    if (this.state === 'HALF_OPEN') {
      console.log(`🟢 [${this.name}] Service recovered, circuit CLOSED`);
      this.state = 'CLOSED';
      this.lastStateChange = Date.now();
    }
  }

  /**
   * Handle failed operation
   */
  onFailure() {
    this.failures++;
    this.totalFailures++;
    this.lastFailTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      console.warn(`🔴 [${this.name}] Service still failing, circuit OPEN`);
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
      return;
    }

    if (this.failures >= this.threshold) {
      console.warn(
        `🔴 [${this.name}] Threshold reached (${this.failures}/${this.threshold}), circuit OPEN`
      );
      this.state = 'OPEN';
      this.lastStateChange = Date.now();
    }
  }

  /**
   * Check if should attempt reset
   * @returns {boolean} - True if cooldown period has passed
   */
  shouldAttemptReset() {
    return Date.now() - this.lastFailTime >= this.cooldown;
  }

  /**
   * Manually reset circuit breaker
   */
  reset() {
    console.log(`🔄 [${this.name}] Manual reset`);
    this.state = 'CLOSED';
    this.failures = 0;
    this.successes = 0;
    this.lastStateChange = Date.now();
  }

  /**
   * Manually open circuit breaker
   */
  open() {
    console.warn(`🔴 [${this.name}] Manual open`);
    this.state = 'OPEN';
    this.lastFailTime = Date.now();
    this.lastStateChange = Date.now();
  }

  /**
   * Get current state
   * @returns {string} - Current state
   */
  getState() {
    return this.state;
  }

  /**
   * Get statistics
   * @returns {object} - Circuit breaker statistics
   */
  getStats() {
    const totalRequests = this.totalRequests;
    const successRate = totalRequests > 0
      ? ((this.totalSuccesses / totalRequests) * 100).toFixed(2)
      : 0;
    const failureRate = totalRequests > 0
      ? ((this.totalFailures / totalRequests) * 100).toFixed(2)
      : 0;

    return {
      name: this.name,
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      threshold: this.threshold,
      totalRequests,
      totalSuccesses: this.totalSuccesses,
      totalFailures: this.totalFailures,
      successRate: `${successRate}%`,
      failureRate: `${failureRate}%`,
      uptime: Date.now() - this.lastStateChange,
      lastFailTime: this.lastFailTime,
    };
  }

  /**
   * Check if circuit is healthy
   * @returns {boolean} - True if circuit is closed
   */
  isHealthy() {
    return this.state === 'CLOSED';
  }

  /**
   * Log current statistics
   */
  logStats() {
    const stats = this.getStats();
    console.log(`📊 [${this.name}] Statistics:`, stats);
  }
}

/**
 * Circuit Breaker Manager
 * Manages multiple circuit breakers for different services
 */
class CircuitBreakerManager {
  constructor() {
    this.breakers = new Map();
  }

  /**
   * Get or create circuit breaker
   * @param {string} name - Service name
   * @param {object} options - Circuit breaker options
   * @returns {CircuitBreaker} - Circuit breaker instance
   */
  getBreaker(name, options = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker({ ...options, name }));
    }
    return this.breakers.get(name);
  }

  /**
   * Execute operation with circuit breaker
   * @param {string} name - Service name
   * @param {function} operation - Operation to execute
   * @param {object} options - Circuit breaker options
   * @returns {Promise<any>} - Operation result
   */
  async execute(name, operation, options = {}) {
    const breaker = this.getBreaker(name, options);
    return breaker.execute(operation);
  }

  /**
   * Reset all circuit breakers
   */
  resetAll() {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }

  /**
   * Get all breakers statistics
   * @returns {array} - Array of breaker stats
   */
  getAllStats() {
    const stats = [];
    for (const breaker of this.breakers.values()) {
      stats.push(breaker.getStats());
    }
    return stats;
  }

  /**
   * Log all breakers statistics
   */
  logAllStats() {
    console.log('📊 [Circuit Breaker Manager] All Statistics:');
    for (const breaker of this.breakers.values()) {
      breaker.logStats();
    }
  }

  /**
   * Check if all breakers are healthy
   * @returns {boolean} - True if all breakers are closed
   */
  allHealthy() {
    for (const breaker of this.breakers.values()) {
      if (!breaker.isHealthy()) {
        return false;
      }
    }
    return true;
  }

  /**
   * Get unhealthy breakers
   * @returns {array} - Array of unhealthy breaker names
   */
  getUnhealthyBreakers() {
    const unhealthy = [];
    for (const [name, breaker] of this.breakers.entries()) {
      if (!breaker.isHealthy()) {
        unhealthy.push(name);
      }
    }
    return unhealthy;
  }
}

// Export singleton manager
const circuitBreakerManager = new CircuitBreakerManager();

// Predefined circuit breakers for common services
export const apiCircuitBreaker = circuitBreakerManager.getBreaker('API', {
  threshold: 5,
  cooldown: 60000,
  timeout: 15000,
});

export const syncCircuitBreaker = circuitBreakerManager.getBreaker('Sync', {
  threshold: 3,
  cooldown: 120000, // 2 minutes
  timeout: 30000,
});

export const databaseCircuitBreaker = circuitBreakerManager.getBreaker('Database', {
  threshold: 10,
  cooldown: 30000,
  timeout: 5000,
});

export { CircuitBreaker, circuitBreakerManager };
export default circuitBreakerManager;
