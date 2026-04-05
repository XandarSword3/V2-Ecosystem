/**
 * Integration Test Setup
 *
 * Handles database connection, seeding, and cleanup for integration tests.
 * This file is imported before integration tests run.
 */

import { beforeAll, afterAll, afterEach } from 'vitest';
import http from 'http';
import { TEST_CONFIG, getTestApiBaseUrl, getTestDatabaseUrl, getTestRedisUrl } from './config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test first for overrides
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
// Load backend .env and allow it to override placeholder test values when present.
// This keeps integration setup aligned with the actively running local stack.
dotenv.config({ path: path.resolve(__dirname, '../../.env'), override: true });

// Set test environment variables before any imports
process.env.NODE_ENV = 'test';
// Integration suites exercise business flows and do not attach CSRF cookies/tokens.
// Keep CSRF strict in unit tests, but explicitly bypass it for integration test runs.
if (!process.env.CSRF_BYPASS_IN_TESTS) {
  process.env.CSRF_BYPASS_IN_TESTS = 'true';
}
// Don't override DATABASE_URL if it's already set from .env
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = getTestDatabaseUrl();
}
if (!process.env.TEST_API_URL) {
  process.env.TEST_API_URL = 'http://localhost:3006/api/v1';
}
// Only set REDIS_URL if not already set
if (!process.env.REDIS_URL) {
  process.env.REDIS_URL = getTestRedisUrl();
}
// Use JWT secrets from .env if available, otherwise use test defaults
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = 'integration-test-jwt-secret-key-very-long-and-secure';
}
if (!process.env.JWT_REFRESH_SECRET) {
  process.env.JWT_REFRESH_SECRET = 'integration-test-refresh-secret-key-very-long';
}
process.env.JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m';
process.env.JWT_REFRESH_EXPIRES_IN = process.env.JWT_REFRESH_EXPIRES_IN || '7d';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

interface IntegrationLifecycleState {
  initialized: boolean;
  initializing: Promise<void> | null;
  apiServer: http.Server | null;
  activeSuites: number;
}

const lifecycleKey = '__v2IntegrationLifecycleState__';
const lifecycleState = ((globalThis as Record<string, unknown>)[lifecycleKey] as IntegrationLifecycleState | undefined) || {
  initialized: false,
  initializing: null,
  apiServer: null,
  activeSuites: 0,
};
(globalThis as Record<string, unknown>)[lifecycleKey] = lifecycleState;

const integrationNoiseFilterKey = '__v2IntegrationNoiseFilterInstalled__';
const integrationOriginalStderrWriteKey = '__v2IntegrationOriginalStderrWrite__';

function shouldSuppressExpectedIntegrationNoise(message: string): boolean {
  const isReactMotionWarning =
    /react does not recognize the `whilehover` prop on a dom element\./i.test(message) ||
    /react does not recognize the `whiletap` prop on a dom element\./i.test(message);

  const isNodeCronSourceMapNoise =
    /node-cron/i.test(message) && /source\s*map|sourcemap/i.test(message);

  const isVitestPoolOptionsDeprecation =
    /pooloptions/i.test(message) && /deprecated|use\s+pool/i.test(message);

  return isReactMotionWarning || isNodeCronSourceMapNoise || isVitestPoolOptionsDeprecation;
}

function installIntegrationNoiseFilter(): void {
  const globalState = globalThis as Record<string, unknown>;
  if (globalState[integrationNoiseFilterKey]) {
    return;
  }

  const originalWrite = process.stderr.write.bind(process.stderr);
  globalState[integrationOriginalStderrWriteKey] = process.stderr.write;

  process.stderr.write = ((chunk: unknown, ...args: unknown[]) => {
    const message = typeof chunk === 'string'
      ? chunk
      : Buffer.isBuffer(chunk)
        ? chunk.toString('utf8')
        : String(chunk ?? '');

    if (message && shouldSuppressExpectedIntegrationNoise(message)) {
      const callback = args.find((arg): arg is (error?: Error | null) => void => typeof arg === 'function');
      if (callback) {
        callback(null);
      }
      return true;
    }

    return (originalWrite as (...writeArgs: unknown[]) => boolean)(chunk, ...args);
  }) as typeof process.stderr.write;

  globalState[integrationNoiseFilterKey] = true;
}

function uninstallIntegrationNoiseFilter(): void {
  const globalState = globalThis as Record<string, unknown>;
  const originalWrite = globalState[integrationOriginalStderrWriteKey] as typeof process.stderr.write | undefined;
  if (originalWrite) {
    process.stderr.write = originalWrite;
  }
  globalState[integrationNoiseFilterKey] = false;
}

installIntegrationNoiseFilter();

/**
 * Test context shared across tests
 */
export interface TestContext {
  adminToken: string | null;
  staffToken: string | null;
  customerToken: string | null;
  createdResources: Map<string, string[]>; // type -> ids for cleanup
}

export const testContext: TestContext = {
  adminToken: null,
  staffToken: null,
  customerToken: null,
  createdResources: new Map(),
};

/**
 * Track a created resource for cleanup
 */
export function trackResource(type: string, id: string): void {
  const existing = testContext.createdResources.get(type) || [];
  existing.push(id);
  testContext.createdResources.set(type, existing);
}

/**
 * Clear all tracked resources
 */
export function clearTrackedResources(): void {
  testContext.createdResources.clear();
}

/**
 * Check if test database is available
 */
export async function isDatabaseAvailable(): Promise<boolean> {
  try {
    const { Pool } = await import('pg');
    const pool = new Pool({
      connectionString: getTestDatabaseUrl(),
      connectionTimeoutMillis: 5000,
    });

    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    await pool.end();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if Redis is available
 */
export async function isRedisAvailable(): Promise<boolean> {
  try {
    const Redis = (await import('ioredis')).default;
    const redis = new Redis(getTestRedisUrl(), {
      connectTimeout: 5000,
      maxRetriesPerRequest: 1,
    });

    await redis.ping();
    await redis.quit();
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if API is available (more important than direct DB check for integration tests)
 */
export async function isApiAvailable(): Promise<boolean> {
  try {
    const response = await fetch(`${getTestApiBaseUrl()}/health`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/**
 * Wait for services to be ready
 * For integration tests against live API, we primarily need the API to be available
 */
export async function waitForServices(
  maxAttempts = 10,
  delayMs = 1000
): Promise<{ database: boolean; redis: boolean; api: boolean }> {
  let dbReady = false;
  let redisReady = false;
  let apiReady = false;

  for (let i = 0; i < maxAttempts && !apiReady; i++) {
    if (!apiReady) apiReady = await isApiAvailable();
    if (!dbReady) dbReady = await isDatabaseAvailable();
    if (!redisReady) redisReady = await isRedisAvailable();

    if (!apiReady) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }

  // API availability is the primary requirement
  // Database/Redis checks are secondary since the API handles its own connections
  return { database: dbReady, redis: redisReady, api: apiReady };
}

/**
 * Seed test database with required data
 */
export async function seedTestDatabase(): Promise<void> {
  const { Pool } = await import('pg');
  const bcrypt = await import('bcryptjs');
  const { migrate } = await import('../../src/database/migrate');

  const pool = new Pool({ connectionString: getTestDatabaseUrl() });

  const forceMigrate = process.env.TEST_FORCE_MIGRATE === 'true';
  const hasUsersResult = await pool.query<{ table_name: string | null }>(
    "SELECT to_regclass('public.users') AS table_name"
  );
  const hasRolesResult = await pool.query<{ table_name: string | null }>(
    "SELECT to_regclass('public.roles') AS table_name"
  );

  const hasUsersTable = Boolean(hasUsersResult.rows[0]?.table_name);
  const hasRolesTable = Boolean(hasRolesResult.rows[0]?.table_name);
  const shouldMigrate = forceMigrate || !hasUsersTable || !hasRolesTable;

  if (shouldMigrate) {
    try {
      console.log('Running migrations for test database...');
      await migrate();
      console.log('✅ Test database migrated successfully');
    } catch (error) {
      console.error('❌ Test database migration failed:', error);
      throw error;
    }
  } else {
    console.log('✅ Reusing existing migrated schema for integration tests');
  }


  try {
    // Seed the role catalog required by auth/authorization middleware.
    await pool.query(`
      INSERT INTO roles (name, display_name, description, business_unit)
      VALUES
        ('super_admin', 'Super Administrator', 'Full system access', 'admin'),
        ('admin', 'Administrator', 'Administrative access', 'admin'),
        ('manager', 'Manager', 'Manager access', 'admin'),
        ('customer', 'Customer', 'Registered customer', NULL),
        ('staff', 'Staff', 'Generic staff role', NULL),
        ('restaurant_staff', 'Restaurant Staff', 'Restaurant operations', 'restaurant'),
        ('restaurant_admin', 'Restaurant Admin', 'Restaurant management', 'restaurant'),
        ('pool_staff', 'Pool Staff', 'Pool operations', 'pool'),
        ('pool_admin', 'Pool Admin', 'Pool management', 'pool'),
        ('chalet_staff', 'Chalet Staff', 'Chalet operations', 'chalets'),
        ('chalet_admin', 'Chalet Admin', 'Chalet management', 'chalets'),
        ('housekeeping_staff', 'Housekeeping Staff', 'Housekeeping operations', 'chalets'),
        ('snack_bar_staff', 'Snack Bar Staff', 'Snack bar operations', 'snack_bar'),
        ('snack_bar_admin', 'Snack Bar Admin', 'Snack bar management', 'snack_bar')
      ON CONFLICT (name) DO UPDATE SET
        display_name = EXCLUDED.display_name,
        description = EXCLUDED.description,
        business_unit = EXCLUDED.business_unit;
    `);

    // Create password hashes
    const adminPasswordHash = await bcrypt.hash(TEST_CONFIG.users.admin.password, 12);
    const staffPasswordHash = await bcrypt.hash(TEST_CONFIG.users.staff.password, 12);
    const customerPasswordHash = await bcrypt.hash(TEST_CONFIG.users.customer.password, 12);

    // Create test users
    await pool.query(`
      INSERT INTO users (id, email, password_hash, full_name, email_verified, is_active)
      VALUES 
        ('11111111-1111-1111-1111-111111111111', $1, $2, $3, true, true),
        ('22222222-2222-2222-2222-222222222222', $4, $5, $6, true, true),
        ('33333333-3333-3333-3333-333333333333', $7, $8, $9, true, true)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name,
        email_verified = EXCLUDED.email_verified,
        is_active = EXCLUDED.is_active
    `, [
      TEST_CONFIG.users.admin.email, adminPasswordHash, TEST_CONFIG.users.admin.fullName,
      TEST_CONFIG.users.staff.email, staffPasswordHash, TEST_CONFIG.users.staff.fullName,
      TEST_CONFIG.users.customer.email, customerPasswordHash, TEST_CONFIG.users.customer.fullName,
    ]);

    const roleAssignments: Array<[string, string]> = [
      [TEST_CONFIG.users.admin.email, 'super_admin'],
      [TEST_CONFIG.users.admin.email, 'admin'],
      [TEST_CONFIG.users.staff.email, 'restaurant_staff'],
      [TEST_CONFIG.users.customer.email, 'customer'],
    ];

    for (const [email, roleName] of roleAssignments) {
      await pool.query(
        `
          INSERT INTO user_roles (user_id, role_id)
          SELECT u.id, r.id
          FROM users u
          JOIN roles r ON r.name = $2
          WHERE u.email = $1
            AND NOT EXISTS (
              SELECT 1
              FROM user_roles ur
              WHERE ur.user_id = u.id
                AND ur.role_id = r.id
            )
        `,
        [email, roleName]
      );
    }

    console.log('✅ Test database seeded successfully');
  } finally {
    await pool.end();
  }
}

/**
 * Clean up test data after tests
 */
export async function cleanupTestDatabase(): Promise<void> {
  if (process.env.SKIP_CLEANUP === 'true') {
     console.log('⚠️ Skipping test database cleanup (SKIP_CLEANUP=true)');
     return; 
  }

  const dbAvailable = await isDatabaseAvailable();
  if (!dbAvailable) {
    console.log('⚠️ Skipping test database cleanup (database not reachable)');
    return;
  }

  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: getTestDatabaseUrl() });

  try {
    // Cleanup resources tracked during tests
    for (const [type, ids] of testContext.createdResources) {
      if (ids.length > 0) {
        await pool.query(`DELETE FROM ${type} WHERE id = ANY($1::uuid[])`, [ids]);
      }
    }

    clearTrackedResources();
    console.log('✅ Test database cleaned up');
  } finally {
    await pool.end();
  }
}

/**
 * Reset test context between test suites
 */
export function resetTestContext(): void {
  testContext.adminToken = null;
  testContext.staffToken = null;
  testContext.customerToken = null;
  clearTrackedResources();
}

async function clearRateLimitState(): Promise<void> {
  try {
    const { cache } = await import('../../src/utils/cache.js');
    const patterns = [
      'rate:login:*',
      'rate:register:*',
      'rate:reset:*',
      'rate:2fa:*',
      'rate:api:*',
      'rate:write:*',
      'rate:sensitive:*',
      'rate:expensive:*',
      'lockout:*',
    ];

    await Promise.all(patterns.map((pattern) => cache.delPattern(pattern)));
  } catch (error) {
    console.warn('⚠️ Failed to clear integration rate-limit state:', error);
  }
}

function resolveManagedApiPort(): number {
  try {
    const baseUrl = getTestApiBaseUrl();
    const parsed = new URL(baseUrl);
    return Number(parsed.port || '3005');
  } catch {
    return 3005;
  }
}

async function startManagedApiServer(port: number): Promise<http.Server> {
  const { default: app } = await import('../../src/app');
  const { initializeSocketServer } = await import('../../src/socket/index.js');

  return new Promise<http.Server>((resolve, reject) => {
    const server = http.createServer(app);
    initializeSocketServer(server);

    server.once('error', (error: NodeJS.ErrnoException) => {
      reject(error);
    });

    server.listen(port, '127.0.0.1', () => {
      resolve(server);
    });
  });
}

async function initializeIntegrationLifecycle(): Promise<void> {
  if (lifecycleState.initialized) {
    return;
  }

  if (lifecycleState.initializing) {
    await lifecycleState.initializing;
    return;
  }

  lifecycleState.initializing = (async () => {
    const useExistingApi = process.env.USE_EXISTING_TEST_API === 'true';

    const shouldSkipDbSeed = process.env.TEST_SKIP_DB_SEED === 'true';
    const dbReadyForSeed = await isDatabaseAvailable();

    if (shouldSkipDbSeed) {
      console.log('⚠️ Skipping test database seed (TEST_SKIP_DB_SEED=true)');
    } else if (!dbReadyForSeed) {
      console.log('⚠️ Skipping test database seed (database not reachable)');
    } else {
      await seedTestDatabase();
    }

    await clearRateLimitState();

    if (!useExistingApi) {
      const port = resolveManagedApiPort();
      process.env.PORT = String(port);

      try {
        lifecycleState.apiServer = await startManagedApiServer(port);
        console.log(`✅ Started managed integration API on port ${port}`);
      } catch (error) {
        if ((error as NodeJS.ErrnoException)?.code === 'EADDRINUSE') {
          console.log(`ℹ️ Reusing existing integration API on port ${port}`);
          lifecycleState.apiServer = null;
        } else {
          throw error;
        }
      }
    }

    const services = await waitForServices(20, 1000);
    if (!services.api) {
      throw new Error(
        `Integration API is not reachable at ${getTestApiBaseUrl()}. Ensure backend startup and TEST_API_URL are aligned.`
      );
    }

    lifecycleState.initialized = true;
  })();

  try {
    await lifecycleState.initializing;
  } finally {
    lifecycleState.initializing = null;
  }
}

async function teardownIntegrationLifecycle(): Promise<void> {
  if (!lifecycleState.initialized) {
    return;
  }

  await cleanupTestDatabase();

  if (lifecycleState.apiServer) {
    await new Promise<void>((resolve, reject) => {
      lifecycleState.apiServer!.close((error?: Error) => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
    lifecycleState.apiServer = null;
  }

  lifecycleState.initialized = false;
}

beforeAll(async () => {
  lifecycleState.activeSuites += 1;
  await initializeIntegrationLifecycle();
});

afterEach(async () => {
  resetTestContext();
  await clearRateLimitState();
});

afterAll(async () => {
  lifecycleState.activeSuites = Math.max(0, lifecycleState.activeSuites - 1);

  if (lifecycleState.activeSuites === 0) {
    await teardownIntegrationLifecycle();
    uninstallIntegrationNoiseFilter();
  }
});
