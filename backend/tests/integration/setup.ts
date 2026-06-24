/**
 * Integration Test Setup
 *
 * Handles database connection, seeding, and cleanup for integration tests.
 * This file is imported before integration tests run.
 */

import http from 'http';
import { TEST_CONFIG, getTestApiBaseUrl, getTestDatabaseUrl, getTestRedisUrl } from './config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env.test first for overrides
dotenv.config({ path: path.resolve(__dirname, '../../.env.test') });
// Load backend .env but DO NOT override process env (CI passes live URLs/keys).
// This keeps local runs convenient while respecting explicitly-provided variables.
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

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
process.env.CORS_ORIGINS = process.env.CORS_ORIGINS || process.env.CORS_ORIGIN || 'http://localhost:3000';
process.env.CORS_ORIGIN = process.env.CORS_ORIGIN || process.env.CORS_ORIGINS;

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

/** @see ARCHITECTURE_LAW.md — these tables/views must never be used again. */
const DEAD_LEGACY_TABLES = new Set([
  'menu_service_orders',
  'capacity_access_tickets',
  'unit_bookings',
  'kiosk_orders',
  'tickets',
  'bookings',
  'orders',
]);

/**
 * Track a created resource for cleanup.
 * Only real tables are allowed; engine records must use type `transactions`.
 */
export function trackResource(type: string, id: string): void {
  if (DEAD_LEGACY_TABLES.has(type)) {
    throw new Error(
      `ARCHITECTURE_LAW: cannot track "${type}" for cleanup. Use trackTransaction() from engine-refit-helpers.ts.`,
    );
  }
  const existing = testContext.createdResources.get(type) || [];
  existing.push(id);
  testContext.createdResources.set(type, existing);
}

/** Track an engine-refit transaction row for teardown. */
export function trackTransaction(id: string): void {
  if (!id) return;
  trackResource('transactions', id);
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
    const connectionString = getTestDatabaseUrl();
    const isLocalConnection = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
    const pool = new Pool({
      connectionString,
      connectionTimeoutMillis: 5000,
      ssl: isLocalConnection ? false : {
        rejectUnauthorized: false,
      },
    });

    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    await pool.end();
    return true;
  } catch (error) {
    console.error('Database connection test failed:', error);
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
 * Seed test users/roles via Supabase HTTP API when direct PG is unavailable.
 */
export async function seedTestDatabaseViaSupabase(): Promise<void> {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey =
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    throw new Error(
      'Supabase HTTP seed requires SUPABASE_URL and SUPABASE_SERVICE_KEY (or SUPABASE_SERVICE_ROLE_KEY)',
    );
  }

  const { createClient } = await import('@supabase/supabase-js');
  const bcrypt = await import('bcryptjs');
  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const roles = [
    { name: 'super_admin', display_name: 'Super Administrator', description: 'Full system access', business_unit: 'admin' },
    { name: 'admin', display_name: 'Administrator', description: 'Administrative access', business_unit: 'admin' },
    { name: 'manager', display_name: 'Manager', description: 'Manager access', business_unit: 'admin' },
    { name: 'customer', display_name: 'Customer', description: 'Registered customer', business_unit: null },
    { name: 'staff', display_name: 'Staff', description: 'Generic staff role', business_unit: null },
  ];

  const { error: rolesError } = await supabase.from('roles').upsert(roles, { onConflict: 'name' });
  if (rolesError) {
    throw new Error(`Supabase seed roles failed: ${rolesError.message}`);
  }

  const adminPasswordHash = await bcrypt.hash(TEST_CONFIG.users.admin.password, 12);
  const staffPasswordHash = await bcrypt.hash(TEST_CONFIG.users.staff.password, 12);
  const customerPasswordHash = await bcrypt.hash(TEST_CONFIG.users.customer.password, 12);

  const users = [
    {
      id: '11111111-1111-1111-1111-111111111111',
      email: TEST_CONFIG.users.admin.email,
      password_hash: adminPasswordHash,
      full_name: TEST_CONFIG.users.admin.fullName,
      email_verified: true,
      is_active: true,
    },
    {
      id: '22222222-2222-2222-2222-222222222222',
      email: TEST_CONFIG.users.staff.email,
      password_hash: staffPasswordHash,
      full_name: TEST_CONFIG.users.staff.fullName,
      email_verified: true,
      is_active: true,
    },
    {
      id: '33333333-3333-3333-3333-333333333333',
      email: TEST_CONFIG.users.customer.email,
      password_hash: customerPasswordHash,
      full_name: TEST_CONFIG.users.customer.fullName,
      email_verified: true,
      is_active: true,
    },
  ];

  const { error: usersError } = await supabase.from('users').upsert(users, { onConflict: 'id' });
  if (usersError) {
    throw new Error(`Supabase seed users failed: ${usersError.message}`);
  }

  const roleAssignments: Array<[string, string]> = [
    [TEST_CONFIG.users.admin.email, 'super_admin'],
    [TEST_CONFIG.users.admin.email, 'admin'],
    [TEST_CONFIG.users.staff.email, 'staff'],
    [TEST_CONFIG.users.customer.email, 'customer'],
  ];

  for (const [email, roleName] of roleAssignments) {
    const { data: userRow, error: userLookupError } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single();
    if (userLookupError || !userRow) {
      throw new Error(`Supabase seed user lookup failed for ${email}: ${userLookupError?.message}`);
    }

    const { data: roleRow, error: roleLookupError } = await supabase
      .from('roles')
      .select('id')
      .eq('name', roleName)
      .single();
    if (roleLookupError || !roleRow) {
      throw new Error(`Supabase seed role lookup failed for ${roleName}: ${roleLookupError?.message}`);
    }

    const { data: existingLink } = await supabase
      .from('user_roles')
      .select('user_id')
      .eq('user_id', userRow.id)
      .eq('role_id', roleRow.id)
      .maybeSingle();

    if (!existingLink) {
      const { error: linkError } = await supabase.from('user_roles').insert({
        user_id: userRow.id,
        role_id: roleRow.id,
      });
      if (linkError) {
        throw new Error(`Supabase seed user_roles failed: ${linkError.message}`);
      }
    }
  }

  console.log('✅ Test database seeded successfully via Supabase HTTP API');
}

/**
 * Seed test database with required data
 */
export async function seedTestDatabase(): Promise<void> {
  const { Pool } = await import('pg');
  const bcrypt = await import('bcryptjs');
  const { migrate } = await import('../../src/database/migrate');

  const connectionString = getTestDatabaseUrl();
  const isLocalConnection = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const pool = new Pool({
    connectionString,
    ssl: isLocalConnection ? false : {
      rejectUnauthorized: false,
    },
  });

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


  // Acquire a dedicated client so we can run the entire seed inside a single
  // transaction with row_security disabled.  RLS policies on the users table
  // check auth.uid() which returns NULL in plain-Postgres CI (no GoTrue), so
  // any INSERT/UPDATE via pool.query() would be silently blocked.  Using
  // SET LOCAL inside a transaction scopes the bypass to this block only.
  const seedClient = await pool.connect();
  try {
    await seedClient.query('BEGIN');
    await seedClient.query('SET LOCAL row_security = off');

    // Seed the role catalog required by auth/authorization middleware.
    await seedClient.query(`
      INSERT INTO roles (name, display_name, description, business_unit)
      VALUES
        ('super_admin', 'Super Administrator', 'Full system access', 'admin'),
        ('admin', 'Administrator', 'Administrative access', 'admin'),
        ('manager', 'Manager', 'Manager access', 'admin'),
        ('customer', 'Customer', 'Registered customer', NULL),
        ('staff', 'Staff', 'Generic staff role', NULL)
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
    await seedClient.query(`
      INSERT INTO users (id, email, password_hash, full_name, email_verified, is_active)
      VALUES 
        ('11111111-1111-1111-1111-111111111111', $1, $2, $3, true, true),
        ('22222222-2222-2222-2222-222222222222', $4, $5, $6, true, true),
        ('33333333-3333-3333-3333-333333333333', $7, $8, $9, true, true)
      ON CONFLICT (id) DO UPDATE SET
        email = EXCLUDED.email,
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
      [TEST_CONFIG.users.staff.email, 'staff'],
      [TEST_CONFIG.users.customer.email, 'customer'],
    ];

    for (const [email, roleName] of roleAssignments) {
      await seedClient.query(
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

    await seedClient.query('COMMIT');
    console.log('✅ Test database seeded successfully');
  } catch (seedError) {
    await seedClient.query('ROLLBACK').catch(() => {});
    throw seedError;
  } finally {
    seedClient.release();
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
  const connectionString = getTestDatabaseUrl();
  const isLocalConnection = connectionString.includes('localhost') || connectionString.includes('127.0.0.1');
  const pool = new Pool({
    connectionString,
    ssl: isLocalConnection ? false : {
      rejectUnauthorized: false,
    },
  });

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
      console.log('⚠️ Direct PG unreachable — attempting Supabase HTTP seed...');
      try {
        await seedTestDatabaseViaSupabase();
      } catch (supabaseSeedError) {
        console.error('❌ Supabase HTTP seed failed:', supabaseSeedError);
        console.log('⚠️ Continuing without seed; auth-dependent tests may return 401');
      }
    } else {
      try {
        await seedTestDatabase();
      } catch (pgSeedError) {
        console.warn('⚠️ PG seed failed, falling back to Supabase HTTP seed:', pgSeedError);
        await seedTestDatabaseViaSupabase();
      }
    }

    // Migrations seed active modules; routes mount only after loadDynamicModules().
    const dbReadyForModules = await isDatabaseAvailable();
    if (dbReadyForModules) {
      const { loadDynamicModules } = await import('../../src/routes/dynamic-modules.loader.js');
      try {
        await loadDynamicModules();
      } catch (error) {
        if (process.env.TEST_SKIP_DB_SEED === 'true') {
          console.warn('⚠️ Failed to load dynamic modules (ok for isolated middleware tests):', error);
        } else {
          throw error;
        }
      }
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
