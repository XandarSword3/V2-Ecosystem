/**
 * Test Credentials Configuration
 * 
 * Centralized configuration for test credentials.
 * In production, these should be set via environment variables.
 * 
 * SECURITY NOTE: This file should NOT contain real credentials.
 * All values should come from environment variables in production.
 */

// Check if we're in a production environment
const isProduction = process.env.NODE_ENV === 'production';

// Development/test credentials (only used in non-production)
const DEV_CREDENTIALS = {
  ADMIN_EMAIL: 'admin@v2resort.com',
  ADMIN_PASSWORD: 'admin123',
  STAFF_EMAIL: 'restaurant.staff@v2resort.com',
  STAFF_PASSWORD: 'staff123',
};

/**
 * Get test credentials from environment or defaults
 * Throws error in production if env vars are not set
 */
function getCredential(key: keyof typeof DEV_CREDENTIALS, envKey: string): string {
  const envValue = process.env[envKey];
  
  if (envValue) {
    return envValue;
  }
  
  if (isProduction) {
    throw new Error(
      `Missing required environment variable: ${envKey}. ` +
      `Do not use default credentials in production.`
    );
  }
  
  // Development fallback with warning
  console.warn(
    `⚠️  Using default test credential for ${key}. ` +
    `Set ${envKey} in environment for custom value.`
  );
  
  return DEV_CREDENTIALS[key];
}

export const testCredentials = {
  get adminEmail(): string {
    return getCredential('ADMIN_EMAIL', 'TEST_ADMIN_EMAIL');
  },
  get adminPassword(): string {
    return getCredential('ADMIN_PASSWORD', 'TEST_ADMIN_PASSWORD');
  },
  get staffEmail(): string {
    return getCredential('STAFF_EMAIL', 'TEST_STAFF_EMAIL');
  },
  get staffPassword(): string {
    return getCredential('STAFF_PASSWORD', 'TEST_STAFF_PASSWORD');
  },
};

// For E2E tests that need credentials
export const e2eCredentials = {
  admin: {
    email: process.env.E2E_ADMIN_EMAIL || 'admin@v2resort.com',
    password: process.env.E2E_ADMIN_PASSWORD || 'Admin123!',
  },
  customer: {
    email: process.env.E2E_CUSTOMER_EMAIL || 'customer@test.com',
    password: process.env.E2E_CUSTOMER_PASSWORD || 'Customer123!',
  },
};

export default testCredentials;
