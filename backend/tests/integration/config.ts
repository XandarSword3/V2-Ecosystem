/**
 * Integration Test Configuration
 *
 * Environment configuration for integration tests.
 * Uses separate database and ports from development.
 */

export const TEST_CONFIG = {
  // Database configuration
  database: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
    user: process.env.TEST_DB_USER || 'v2resort_test',
    password: process.env.TEST_DB_PASSWORD || 'v2resort_test_secret',
    database: process.env.TEST_DB_NAME || 'v2resort_test',
  },

  // Redis configuration
  redis: {
    host: process.env.TEST_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.TEST_REDIS_PORT || '6380', 10),
    url: process.env.TEST_REDIS_URL,
  },

  // API configuration
  api: {
    baseUrl: process.env.TEST_API_URL || 'http://localhost:3005/api/v1',
    timeout: 30000, // 30 seconds for slow operations
  },

  // Test users (must exist in database - use real credentials for live testing)
  users: {
    admin: {
      email: process.env.TEST_ADMIN_EMAIL || 'admin@v2resort.com',
      password: process.env.TEST_ADMIN_PASSWORD || 'admin123',
      fullName: 'Administrator',
    },
    staff: {
      email: process.env.TEST_STAFF_EMAIL || 'restaurant.staff@v2resort.com',
      password: process.env.TEST_STAFF_PASSWORD || 'staff123',
      fullName: 'Restaurant Staff',
    },
    customer: {
      email: process.env.TEST_CUSTOMER_EMAIL || 'customer.test@v2resort.local',
      password: process.env.TEST_CUSTOMER_PASSWORD || 'TestCustomer123!',
      fullName: 'Test Customer',
    },
  },

  // Timeouts
  timeouts: {
    short: 5000,
    medium: 15000,
    long: 30000,
  },
};

/**
 * Get database connection string for integration tests
 * Uses DATABASE_URL env var if available (for live environment testing)
 */
export function getTestDatabaseUrl(): string {
  // Only use env var if specifically set for testing, ignore general DATABASE_URL to avoid prod leaks
  if (process.env.TEST_DATABASE_URL) {
    return process.env.TEST_DATABASE_URL;
  }
  const { host, port, user, password, database } = TEST_CONFIG.database;
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

/**
 * Get Redis connection string for integration tests
 * Uses REDIS_URL env var if available
 */
export function getTestRedisUrl(): string {
  if (TEST_CONFIG.redis.url) {
    return TEST_CONFIG.redis.url;
  }
  const { host, port } = TEST_CONFIG.redis;
  return `redis://${host}:${port}`;
}
