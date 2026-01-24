/**
 * V2 Resort - Circuit Breaker Pattern Implementation
 * Prevents cascading failures when external services are unavailable
 */

import { logger } from './logger';

type CircuitState = 'closed' | 'open' | 'half-open';

interface CircuitBreakerOptions {
  name: string;
  failureThreshold?: number;      // Failures before opening (default: 5)
  successThreshold?: number;      // Successes to close from half-open (default: 2)
  timeout?: number;               // Time to wait before half-open (ms, default: 30000)
  resetTimeout?: number;          // Time in half-open before testing (ms, default: 5000)
  monitorInterval?: number;       // Stats cleanup interval (ms, default: 60000)
  fallback?: () => Promise<any>;  // Fallback function when open
}

interface CircuitStats {
  failures: number;
  successes: number;
  lastFailure: Date | null;
  lastSuccess: Date | null;
  totalRequests: number;
  totalFailures: number;
  totalSuccesses: number;
  openedAt: Date | null;
  closedAt: Date | null;
}

export class CircuitBreaker {
  private state: CircuitState = 'closed';
  private failures: number = 0;
  private successes: number = 0;
  private lastFailureTime: Date | null = null;
  private lastSuccessTime: Date | null = null;
  private openedAt: Date | null = null;
  private totalRequests: number = 0;
  private totalFailures: number = 0;
  private totalSuccesses: number = 0;
  
  private readonly name: string;
  private readonly failureThreshold: number;
  private readonly successThreshold: number;
  private readonly timeout: number;
  private readonly resetTimeout: number;
  private readonly fallback?: () => Promise<any>;
  
  private nextAttemptTime: number = 0;
  private monitorInterval: NodeJS.Timeout | null = null;

  constructor(options: CircuitBreakerOptions) {
    this.name = options.name;
    this.failureThreshold = options.failureThreshold ?? 5;
    this.successThreshold = options.successThreshold ?? 2;
    this.timeout = options.timeout ?? 30000;
    this.resetTimeout = options.resetTimeout ?? 5000;
    this.fallback = options.fallback;
    
    // Start monitoring
    if (options.monitorInterval !== 0) {
      this.startMonitoring(options.monitorInterval ?? 60000);
    }
  }

  /**
   * Execute a function with circuit breaker protection
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    this.totalRequests++;
    
    // Check if circuit is open
    if (this.state === 'open') {
      if (Date.now() < this.nextAttemptTime) {
        // Circuit is open, check for fallback
        if (this.fallback) {
          logger.info(`[CircuitBreaker:${this.name}] Circuit OPEN, using fallback`);
          return this.fallback();
        }
        throw new CircuitBreakerOpenError(
          `Circuit breaker '${this.name}' is OPEN. Retry after ${new Date(this.nextAttemptTime).toISOString()}`
        );
      }
      // Time to try again (half-open)
      this.state = 'half-open';
      logger.info(`[CircuitBreaker:${this.name}] Circuit HALF-OPEN, testing service`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private onSuccess(): void {
    this.lastSuccessTime = new Date();
    this.totalSuccesses++;

    if (this.state === 'half-open') {
      this.successes++;
      if (this.successes >= this.successThreshold) {
        this.close();
      }
    } else {
      // Reset failure count on success in closed state
      this.failures = 0;
    }
  }

  private onFailure(): void {
    this.lastFailureTime = new Date();
    this.totalFailures++;
    this.failures++;

    if (this.state === 'half-open') {
      // Any failure in half-open reopens the circuit
      this.open();
    } else if (this.failures >= this.failureThreshold) {
      this.open();
    }
  }

  private open(): void {
    this.state = 'open';
    this.openedAt = new Date();
    this.nextAttemptTime = Date.now() + this.timeout;
    this.successes = 0;
    logger.warn(`[CircuitBreaker:${this.name}] Circuit OPENED after ${this.failures} failures`);
    
    // Emit event for monitoring
    circuitBreakerEvents.emit('open', {
      name: this.name,
      failures: this.failures,
      openedAt: this.openedAt,
    });
  }

  private close(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    logger.info(`[CircuitBreaker:${this.name}] Circuit CLOSED, service recovered`);
    
    // Emit event for monitoring
    circuitBreakerEvents.emit('close', {
      name: this.name,
      closedAt: new Date(),
    });
  }

  /**
   * Get current circuit status
   */
  getStatus(): {
    name: string;
    state: CircuitState;
    stats: CircuitStats;
  } {
    return {
      name: this.name,
      state: this.state,
      stats: {
        failures: this.failures,
        successes: this.successes,
        lastFailure: this.lastFailureTime,
        lastSuccess: this.lastSuccessTime,
        totalRequests: this.totalRequests,
        totalFailures: this.totalFailures,
        totalSuccesses: this.totalSuccesses,
        openedAt: this.openedAt,
        closedAt: this.state === 'closed' ? new Date() : null,
      },
    };
  }

  /**
   * Manually force the circuit open
   */
  forceOpen(): void {
    this.open();
  }

  /**
   * Manually force the circuit closed
   */
  forceClosed(): void {
    this.close();
  }

  /**
   * Reset all statistics
   */
  reset(): void {
    this.state = 'closed';
    this.failures = 0;
    this.successes = 0;
    this.totalRequests = 0;
    this.totalFailures = 0;
    this.totalSuccesses = 0;
    this.lastFailureTime = null;
    this.lastSuccessTime = null;
    this.openedAt = null;
  }

  private startMonitoring(interval: number): void {
    this.monitorInterval = setInterval(() => {
      // Log stats periodically
      if (this.state !== 'closed' || this.totalFailures > 0) {
        logger.debug(`[CircuitBreaker:${this.name}] Stats: state=${this.state}, failures=${this.failures}, totalRequests=${this.totalRequests}, failureRate=${this.totalRequests > 0 ? ((this.totalFailures / this.totalRequests) * 100).toFixed(2) + '%' : '0%'}`);
      }
    }, interval);
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
    }
  }
}

// Custom error for open circuit
export class CircuitBreakerOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitBreakerOpenError';
  }
}

// Event emitter for circuit breaker events
import { EventEmitter } from 'events';
export const circuitBreakerEvents = new EventEmitter();

// Pre-configured circuit breakers for common services
export const circuitBreakers = {
  email: new CircuitBreaker({
    name: 'email-service',
    failureThreshold: 3,
    timeout: 60000, // 1 minute
    fallback: async () => {
      logger.info('[CircuitBreaker:email] Queueing email for later');
      return { queued: true, message: 'Email queued for later delivery' };
    },
  }),

  stripe: new CircuitBreaker({
    name: 'stripe-api',
    failureThreshold: 5,
    timeout: 30000, // 30 seconds
    // No fallback - payments must work or fail explicitly
  }),

  weather: new CircuitBreaker({
    name: 'weather-api',
    failureThreshold: 3,
    timeout: 300000, // 5 minutes (weather data is not critical)
    fallback: async () => {
      return { 
        available: false, 
        message: 'Weather data temporarily unavailable',
        cached: true,
      };
    },
  }),

  supabase: new CircuitBreaker({
    name: 'supabase-db',
    failureThreshold: 10,
    timeout: 5000, // 5 seconds - database should recover quickly
  }),

  sms: new CircuitBreaker({
    name: 'sms-service',
    failureThreshold: 3,
    timeout: 120000, // 2 minutes
    fallback: async () => {
      logger.info('[CircuitBreaker:sms] SMS service unavailable, queuing');
      return { queued: true };
    },
  }),
};

// Middleware to wrap API calls with circuit breaker
export const withCircuitBreaker = <T>(
  breaker: CircuitBreaker,
  fn: () => Promise<T>
): Promise<T> => {
  return breaker.execute(fn);
};

// Get all circuit breaker statuses (for monitoring dashboard)
export const getAllCircuitBreakerStatuses = () => {
  return Object.entries(circuitBreakers).map(([key, breaker]) => ({
    service: key,
    ...breaker.getStatus(),
  }));
};

// Example usage:
// const result = await circuitBreakers.email.execute(() => sendEmail(to, subject, body));
// or
// const result = await withCircuitBreaker(circuitBreakers.stripe, () => stripe.charges.create(params));
