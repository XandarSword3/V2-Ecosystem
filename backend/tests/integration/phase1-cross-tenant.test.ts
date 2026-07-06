/**
 * Phase 1 — Cross-Tenant Isolation Integration Test
 * 
 * Per §4.2 of Implementation Engine A admin pages.md:
 * "Same check with a real second seeded tenant"
 * 
 * Tests that linkToMenuItem rejects cross-tenant pairings of inventory items
 * and catalog items, using real database tenants and HTTP requests (not mocked).
 * 
 * Note: Cross-property coverage via x-property-id header is deferred here.
 * It's already covered at unit level with mocked dependencies.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import { getTestApiBaseUrl } from './config';
import { Pool } from 'pg';
import bcrypt from 'bcryptjs';

const TEST_API_URL = getTestApiBaseUrl();

// Use test database config from setup.ts pattern
const TEST_DB_HOST = process.env.TEST_DB_HOST || '127.0.0.1';
const TEST_DB_PORT = parseInt(process.env.TEST_DB_PORT || '5432', 10);
const TEST_DB_USER = process.env.TEST_DB_USER || 'v2ecosystem';
const TEST_DB_PASSWORD = process.env.TEST_DB_PASSWORD || 'v2ecosystem_secret';
const TEST_DB_NAME = process.env.TEST_DB_NAME || 'v2ecosystem';

const pool = new Pool({
  host: TEST_DB_HOST,
  port: TEST_DB_PORT,
  user: TEST_DB_USER,
  password: TEST_DB_PASSWORD,
  database: TEST_DB_NAME,
});

describe('Phase 1: Cross-Tenant Isolation (linkToMenuItem)', () => {
  let tenantAId: string;
  let tenantBId: string;
  let propertyAId: string;
  let propertyBId: string;
  let moduleAId: string;
  let moduleBId: string;
  let catalogItemAId: string;
  let catalogItemBId: string;
  let inventoryItemAId: string;
  let inventoryItemBId: string;
  let userAToken: string;
  let userBToken: string;

  beforeAll(async () => {
    // Seed test data directly via SQL (bypasses RLS like setup.ts does)
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('SET LOCAL row_security = off');

      // Generate IDs
      tenantAId = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
      tenantBId = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
      propertyAId = 'cccccccc-cccc-cccc-cccc-cccccccccccc';
      propertyBId = 'dddddddd-dddd-dddd-dddd-dddddddddddd';
      moduleAId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';
      moduleBId = 'ffffffff-ffff-ffff-ffff-ffffffffffff';
      catalogItemAId = '11111111-1111-1111-1111-111111111111';
      catalogItemBId = '22222222-2222-2222-2222-222222222222';
      inventoryItemAId = '33333333-3333-3333-3333-333333333333';
      inventoryItemBId = '44444444-4444-4444-4444-444444444444';

      // Create property group (required for tenants)
      await client.query(`
        INSERT INTO property_groups (id, name, created_at)
        VALUES ($1, 'Test Group A', NOW())
        ON CONFLICT (id) DO NOTHING
      `, ['gggggggg-gggg-gggg-gggg-gggggggggggg']);

      // Create two tenants
      await client.query(`
        INSERT INTO tenants (id, subdomain, property_group_id, subscription_tier, billing_status, created_at)
        VALUES 
          ($1, 'tenant-a-test', 'gggggggg-gggg-gggg-gggg-gggggggggggg', 'starter', 'active', NOW()),
          ($2, 'tenant-b-test', 'gggggggg-gggg-gggg-gggg-gggggggggggg', 'starter', 'active', NOW())
        ON CONFLICT (id) DO NOTHING
      `, [tenantAId, tenantBId]);

      // Create two properties (one per tenant)
      await client.query(`
        INSERT INTO properties (id, name, group_id, public_slug, is_active, created_at)
        VALUES 
          ($1, 'Property A', 'gggggggg-gggg-gggg-gggg-gggggggggggg', 'property-a', true, NOW()),
          ($2, 'Property B', 'gggggggg-gggg-gggg-gggg-gggggggggggg', 'property-b', true, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [propertyAId, propertyBId]);

      // Update properties to have tenant_id (if column exists)
      try {
        await client.query(`
          UPDATE properties SET tenant_id = $1 WHERE id = $2
        `, [tenantAId, propertyAId]);
        await client.query(`
          UPDATE properties SET tenant_id = $1 WHERE id = $2
        `, [tenantBId, propertyBId]);
      } catch (e) {
        // Column might not exist in all schema versions - continue
      }

      // Create two modules (instant_transaction type)
      await client.query(`
        INSERT INTO modules (id, slug, name, engine_type, template_type, property_id, tenant_id, is_active, created_at)
        VALUES 
          ($1, 'module-a', 'Module A', 'instant_transaction', 'menu_service', $2, $3, true, NOW()),
          ($4, 'module-b', 'Module B', 'instant_transaction', 'menu_service', $5, $6, true, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [moduleAId, propertyAId, tenantAId, moduleBId, propertyBId, tenantBId]);

      // Create catalog items (one per module/tenant)
      await client.query(`
        INSERT INTO catalog_items (id, name, description, price, is_available, module_id, tenant_id, created_at)
        VALUES 
          ($1, 'Catalog Item A', 'Test item A', 10.00, true, $2, $3, NOW()),
          ($4, 'Catalog Item B', 'Test item B', 15.00, true, $5, $6, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [catalogItemAId, moduleAId, tenantAId, catalogItemBId, moduleBId, tenantBId]);

      // Create inventory category
      const categoryId = '55555555-5555-5555-5555-555555555555';
      await client.query(`
        INSERT INTO inventory_categories (id, name, tenant_id, created_at)
        VALUES ($1, 'Test Category', $2, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [categoryId, tenantAId]);

      // Create inventory items (one per tenant)
      await client.query(`
        INSERT INTO inventory_items (id, name, sku, current_stock, cost_per_unit, category_id, tenant_id, created_at)
        VALUES 
          ($1, 'Inventory Item A', 'SKU-A', 100, 5.00, $2, $3, NOW()),
          ($4, 'Inventory Item B', 'SKU-B', 50, 7.50, $2, $5, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [inventoryItemAId, categoryId, tenantAId, inventoryItemBId, categoryId, tenantBId]);

      // Create users with admin scope (explicitly set scope to avoid provisioning bug)
      const passwordHashA = await bcrypt.hash('TestPassword123!', 12);
      const passwordHashB = await bcrypt.hash('TestPassword123!', 12);

      await client.query(`
        INSERT INTO users (id, email, password_hash, full_name, email_verified, is_active, scope, tenant_id, created_at)
        VALUES 
          ('uuuuuuuu-uuuu-uuuu-uuuu-uuuuuuuuuuuu', 'user-a@test.com', $1, 'User A', true, true, 'tenant_admin', $2, NOW()),
          ('vvvvvvvv-vvvv-vvvv-vvvv-vvvvvvvvvvvv', 'user-b@test.com', $3, 'User B', true, true, 'tenant_admin', $4, NOW())
        ON CONFLICT (id) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          scope = EXCLUDED.scope,
          tenant_id = EXCLUDED.tenant_id
      `, [passwordHashA, tenantAId, passwordHashB, tenantBId]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Authenticate both users to get JWTs
    const loginA = await fetch(`${TEST_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user-a@test.com',
        password: 'TestPassword123!'
      })
    });

    if (loginA.ok) {
      const dataA = await loginA.json();
      userAToken = dataA.data?.token || dataA.data?.access_token;
    }

    const loginB = await fetch(`${TEST_API_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'user-b@test.com',
        password: 'TestPassword123!'
      })
    });

    if (loginB.ok) {
      const dataB = await loginB.json();
      userBToken = dataB.data?.token || dataB.data?.access_token;
    }
  });

  describe('Cross-tenant rejection', () => {
    it('should reject linking Tenant B inventory item to Tenant A catalog item', async () => {
      if (!userAToken) {
        throw new Error('User A authentication failed');
      }

      const res = await fetch(`${TEST_API_URL}/inventory/items/${inventoryItemBId}/link-menu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userAToken}`,
          'X-Tenant-ID': tenantAId
        },
        body: JSON.stringify({
          catalogItemId: catalogItemAId,
          quantityNeeded: 1
        })
      });

      // Should fail with 403 or 404 (tenant scope check)
      expect(res.ok).toBe(false);
      expect([403, 404].includes(res.status)).toBe(true);
    });

    it('should reject linking Tenant A inventory item to Tenant B catalog item', async () => {
      if (!userBToken) {
        throw new Error('User B authentication failed');
      }

      const res = await fetch(`${TEST_API_URL}/inventory/items/${inventoryItemAId}/link-menu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userBToken}`,
          'X-Tenant-ID': tenantBId
        },
        body: JSON.stringify({
          catalogItemId: catalogItemBId,
          quantityNeeded: 1
        })
      });

      expect(res.ok).toBe(false);
      expect([403, 404].includes(res.status)).toBe(true);
    });
  });

  describe('Same-tenant positive control', () => {
    it('should allow linking Tenant A inventory item to Tenant A catalog item', async () => {
      if (!userAToken) {
        throw new Error('User A authentication failed');
      }

      const res = await fetch(`${TEST_API_URL}/inventory/items/${inventoryItemAId}/link-menu`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${userAToken}`,
          'X-Tenant-ID': tenantAId
        },
        body: JSON.stringify({
          catalogItemId: catalogItemAId,
          quantityNeeded: 1
        })
      });

      expect(res.ok).toBe(true);
    });
  });
});
