/**
 * Integration Test Configuration
 *
 * Environment configuration for integration tests.
 * Uses separate database and ports from development.
 */

export const TEST_CONFIG = {
  // Database configuration (uses docker-compose.test.yml)
  database: {
    host: process.env.TEST_DB_HOST || 'localhost',
    port: parseInt(process.env.TEST_DB_PORT || '5433', 10),
    user: process.env.TEST_DB_USER || 'v2resort_test',
    password: process.env.TEST_DB_PASSWORD || 'v2resort_test_secret',
    database: process.env.TEST_DB_NAME || 'v2resort_test',
  },

  // Redis configuration
  redis: {
    host: process.env.TEST_REDIS_HOST || 'localhost',
    port: parseInt(process.env.TEST_REDIS_PORT || '6380', 10),
  },

  // API configuration
  api: {
    baseUrl: process.env.TEST_API_URL || 'http://localhost:3001/api',
    timeout: 30000, // 30 seconds for slow operations
  },

  // Test users (seeded in database)
  users: {
    admin: {
      email: 'admin.test@v2resort.local',
      password: 'TestAdmin123!',
      fullName: 'Test Administrator',
    },
    staff: {
      email: 'staff.test@v2resort.local',
      password: 'TestStaff123!',
      fullName: 'Test Staff Member',
    },
    customer: {
      email: 'customer.test@v2resort.local',
      password: 'TestCustomer123!',
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
 */
export function getTestDatabaseUrl(): string {
  const { host, port, user, password, database } = TEST_CONFIG.database;
  return `postgresql://${user}:${password}@${host}:${port}/${database}`;
}

/**
 * Get Redis connection string for integration tests
 */
export function getTestRedisUrl(): string {
  const { host, port } = TEST_CONFIG.redis;
  return `redis://${host}:${port}`;
}
