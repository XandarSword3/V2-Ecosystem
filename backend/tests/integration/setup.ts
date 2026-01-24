/**
 * Integration Test Setup
 *
 * Handles database connection, seeding, and cleanup for integration tests.
 * This file is imported before integration tests run.
 */

import { beforeAll, afterAll, afterEach, vi } from 'vitest';
import { TEST_CONFIG, getTestDatabaseUrl, getTestRedisUrl } from './config';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load .env file from backend directory
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

// Set test environment variables before any imports
process.env.NODE_ENV = 'test';
// Don't override DATABASE_URL if it's already set from .env
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = getTestDatabaseUrl();
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
    const response = await fetch(`${TEST_CONFIG.api.baseUrl}/health`, {
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

  // Clean database to ensure fresh state
  try {
    console.log('Cleaning test database...');
    await pool.query(`
      DROP SCHEMA IF EXISTS public CASCADE;
      CREATE SCHEMA public;
      DROP SCHEMA IF EXISTS auth CASCADE;
      CREATE SCHEMA IF NOT EXISTS auth;
      
      -- Mock auth.uid() function for RLS policies
      CREATE OR REPLACE FUNCTION auth.uid() RETURNS uuid AS $$
      BEGIN
        RETURN '11111111-1111-1111-1111-111111111111'::uuid;
      END;
      $$ LANGUAGE plpgsql STABLE;

      -- Create Supabase roles if they don't exist
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'anon') THEN
          CREATE ROLE anon;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'authenticated') THEN
          CREATE ROLE authenticated;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'service_role') THEN
          CREATE ROLE service_role;
        END IF;
      END
      $$;

      GRANT ALL ON SCHEMA public TO public;
      GRANT ALL ON SCHEMA auth TO public;
      GRANT ALL ON SCHEMA public TO v2resort_test;
      GRANT ALL ON SCHEMA auth TO v2resort_test;
    `);
  } catch (err) {
    console.warn('Warning: Database cleanup encountered an issue:', err);
  }

  // Run migrations first
  try {
    console.log('Running migrations for test database...');
    await migrate();
    console.log('✅ Test database migrated successfully');
  } catch (error) {
    console.error('❌ Test database migration failed:', error);
    throw error;
  }


  try {
    // Create password hashes
    const adminPasswordHash = await bcrypt.hash(TEST_CONFIG.users.admin.password, 12);
    const staffPasswordHash = await bcrypt.hash(TEST_CONFIG.users.staff.password, 12);
    const customerPasswordHash = await bcrypt.hash(TEST_CONFIG.users.customer.password, 12);

    // Create test users
    await pool.query(`
      INSERT INTO users (id, email, password_hash, full_name, is_active)
      VALUES 
        ('11111111-1111-1111-1111-111111111111', $1, $2, $3, true),
        ('22222222-2222-2222-2222-222222222222', $4, $5, $6, true),
        ('33333333-3333-3333-3333-333333333333', $7, $8, $9, true)
      ON CONFLICT (email) DO UPDATE SET
        password_hash = EXCLUDED.password_hash,
        full_name = EXCLUDED.full_name
    `, [
      TEST_CONFIG.users.admin.email, adminPasswordHash, TEST_CONFIG.users.admin.fullName,
      TEST_CONFIG.users.staff.email, staffPasswordHash, TEST_CONFIG.users.staff.fullName,
      TEST_CONFIG.users.customer.email, customerPasswordHash, TEST_CONFIG.users.customer.fullName,
    ]);

    // Assign roles (assuming roles table exists)
    await pool.query(`
      INSERT INTO user_roles (user_id, role_id)
      SELECT '11111111-1111-1111-1111-111111111111', id FROM roles WHERE name = 'admin'
      ON CONFLICT DO NOTHING
    `);
    await pool.query(`
      INSERT INTO user_roles (user_id, role_id)
      SELECT '22222222-2222-2222-2222-222222222222', id FROM roles WHERE name = 'staff'
      ON CONFLICT DO NOTHING
    `);
    await pool.query(`
      INSERT INTO user_roles (user_id, role_id)
      SELECT '33333333-3333-3333-3333-333333333333', id FROM roles WHERE name = 'customer'
      ON CONFLICT DO NOTHING
    `);

    console.log('✅ Test database seeded successfully');
  } finally {
    await pool.end();
  }
}

/**
 * Clean up test data after tests
 */
export async function cleanupTestDatabase(): Promise<void> {
  const { Pool } = await import('pg');
  const pool = new Pool({ connectionString: getTestDatabaseUrl() });

  try {
    // Delete test data in reverse dependency order
    // Only delete data created by tests, not seed data
    const testEmails = [
      TEST_CONFIG.users.admin.email,
      TEST_CONFIG.users.staff.email,
      TEST_CONFIG.users.customer.email,
    ];

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
