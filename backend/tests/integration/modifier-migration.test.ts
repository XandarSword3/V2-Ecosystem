/**
 * Phase 2 — Modifiers Migration Integration Test
 * 
 * Tests the migration from legacy menu_modifier_groups/options to the unified customization system.
 * Per §4.2 of Implementation Engine A admin pages.md:
 * "Seed legacy modifier_groups → run /customizations/migrate → assert unified output matches"
 * 
 * Note: This test verifies the migration endpoint works correctly. Since the integration test
 * environment doesn't have direct database access to seed legacy data, we verify the endpoint
 * responds correctly and is idempotent. Full data verification would require a test database
 * with seeded legacy modifier data.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApiBaseUrl } from './config';

const TEST_API_URL = getTestApiBaseUrl();

describe('Modifiers Migration Integration', () => {
  let adminToken: string | null = null;

  beforeAll(async () => {
    // Authenticate as admin to get migration token
    const loginRes = await fetch(`${TEST_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'admin@v2ecosystem.com',
        password: 'admin123'
      })
    });

    if (loginRes.ok) {
      const data = await loginRes.json();
      adminToken = data.data?.token || data.data?.access_token;
    }
  });

  describe('Legacy modifier migration endpoint', () => {
    it('should run migration and return success with counts', async () => {
      if (!adminToken) {
        throw new Error('No admin token available');
      }

      const migrateRes = await fetch(`${TEST_API_URL}/customizations/migrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(migrateRes.ok).toBe(true);

      const data = await migrateRes.json();
      expect(data).toHaveProperty('message', 'Migration completed');
      expect(data).toHaveProperty('groups');
      expect(data).toHaveProperty('options');
      expect(data).toHaveProperty('links');
      
      // Counts should be non-negative integers
      expect(data.groups).toBeGreaterThanOrEqual(0);
      expect(data.options).toBeGreaterThanOrEqual(0);
      expect(data.links).toBeGreaterThanOrEqual(0);
    });

    it('should be idempotent - running twice returns same result', async () => {
      if (!adminToken) {
        throw new Error('No admin token available');
      }

      // First run
      const migrateRes1 = await fetch(`${TEST_API_URL}/customizations/migrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(migrateRes1.ok).toBe(true);
      const data1 = await migrateRes1.json();

      // Second run
      const migrateRes2 = await fetch(`${TEST_API_URL}/customizations/migrate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${adminToken}`
        }
      });

      expect(migrateRes2.ok).toBe(true);
      const data2 = await migrateRes2.json();

      // Results should be identical (ON CONFLICT DO NOTHING)
      expect(data1.groups).toBe(data2.groups);
      expect(data1.options).toBe(data2.options);
      expect(data1.links).toBe(data2.links);
    });
  });
});
