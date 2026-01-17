/**
 * Integration Test Configuration
 *
 * Environment configuration for integration tests.
 * Uses separate database and ports from development.
 */

export const TEST_CONFIG = {
  // Database configuration - defaults to live database when TEST_DB_* not set
  database: {
    // Use the DATABASE_URL env var if no test-specific config is provided
    url: process.env.DATABASE_URL,
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5432', 10),
    user: process.env.TEST_DB_USER || 'postgres',
    password: process.env.TEST_DB_PASSWORD || '',
    database: process.env.TEST_DB_NAME || 'postgres',
  },

  // Redis configuration - optional, tests should work without it
  redis: {
    host: process.env.TEST_REDIS_HOST || process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.TEST_REDIS_PORT || process.env.REDIS_PORT || '6379', 10),
    url: process.env.REDIS_URL,
  },

  // API configuration
  api: {
    baseUrl: process.env.TEST_API_URL || 'http://localhost:3005/api',
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
  // Prefer explicit DATABASE_URL from environment
  if (process.env.DATABASE_URL) {
    return process.env.DATABASE_URL;
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
