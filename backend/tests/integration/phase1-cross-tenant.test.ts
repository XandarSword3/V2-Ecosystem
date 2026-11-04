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
import jwt from 'jsonwebtoken';

const TEST_API_URL = getTestApiBaseUrl();

// Connect with the same URL the rest of the integration suite uses
// (TEST_DATABASE_URL, falling back to DATABASE_URL). The previous discrete
// TEST_DB_* defaults pointed at 127.0.0.1:5432, which never matched the real
// test stack (local supabase CLI Postgres @15432) and always ECONNREFUSED.
const pool = new Pool({
  connectionString: process.env.TEST_DATABASE_URL || process.env.DATABASE_URL,
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
      `, ['77777777-7777-7777-7777-777777777777']);

      // Create two tenants
      await client.query(`
        INSERT INTO tenants (id, subdomain, property_group_id, subscription_tier, billing_status, created_at)
        VALUES 
          ($1, 'tenant-a-test', '77777777-7777-7777-7777-777777777777', 'starter', 'active', NOW()),
          ($2, 'tenant-b-test', '77777777-7777-7777-7777-777777777777', 'starter', 'active', NOW())
        ON CONFLICT (id) DO NOTHING
      `, [tenantAId, tenantBId]);

      // Create two properties (one per tenant). tenant_id is NOT NULL in the
      // current schema, so it must be set at insert time (the old
      // "update afterwards if the column exists" dance predates that).
      await client.query(`
        INSERT INTO properties (id, name, group_id, tenant_id, public_slug, is_active, created_at)
        VALUES 
          ($1, 'Property A', $3, $4, 'property-a', true, NOW()),
          ($2, 'Property B', $3, $5, 'property-b', true, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [propertyAId, propertyBId, '77777777-7777-7777-7777-777777777777', tenantAId, tenantBId]);

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

      // Create catalog items (one per module/tenant). property_id is NOT NULL
      // in the current schema.
      await client.query(`
        INSERT INTO catalog_items (id, name, description, price, is_available, module_id, property_id, tenant_id, created_at)
        VALUES 
          ($1, 'Catalog Item A', 'Test item A', 10.00, true, $2, $4, $3, NOW()),
          ($5, 'Catalog Item B', 'Test item B', 15.00, true, $6, $8, $7, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [catalogItemAId, moduleAId, tenantAId, propertyAId, catalogItemBId, moduleBId, tenantBId, propertyBId]);

      // Create inventory category (property_id NOT NULL in current schema)
      const categoryId = '55555555-5555-5555-5555-555555555555';
      await client.query(`
        INSERT INTO inventory_categories (id, name, property_id, tenant_id, created_at)
        VALUES ($1, 'Test Category', $3, $2, NOW())
        ON CONFLICT (id) DO NOTHING
      `, [categoryId, tenantAId, propertyAId]);

      // Create inventory items (one per tenant; property_id and module_id
      // required by the link-menu property-scope check). DO UPDATE so a row
      // seeded by an older version of this test (without module_id) is
      // refreshed rather than kept stale by ON CONFLICT DO NOTHING.
      await client.query(`
        INSERT INTO inventory_items (id, name, sku, current_stock, cost_per_unit, category_id, module_id, property_id, tenant_id, created_at)
        VALUES 
          ($1, 'Inventory Item A', 'SKU-A', 100, 5.00, $2, $5, $4, $3, NOW()),
          ($6, 'Inventory Item B', 'SKU-B', 50, 7.50, $2, $9, $8, $7, NOW())
        ON CONFLICT (id) DO UPDATE SET
          module_id = EXCLUDED.module_id,
          property_id = EXCLUDED.property_id,
          tenant_id = EXCLUDED.tenant_id,
          category_id = EXCLUDED.category_id
      `, [inventoryItemAId, categoryId, tenantAId, propertyAId, moduleAId, inventoryItemBId, tenantBId, propertyBId, moduleBId]);

      // Create tenant_admin users. The Q103 mandatory-2FA gate blocks the
      // *login flow* for tenant_admin accounts (403 requiresTwoFactorSetup),
      // so this test mints access tokens directly below instead of logging
      // in — token validation (resolveUserFromToken) only checks the DB for
      // is_active/token_version; the 2FA gate is a login-flow gate, not a
      // token gate. tenant_admin is the scope whose derived roles include
      // 'admin', which the route's authorize('admin', 'super_admin') guard
      // requires (property_manager derives ['manager','staff'] and would 403
      // every request, making the cross-tenant assertions vacuous).
      await client.query(`
        INSERT INTO users (id, email, password_hash, full_name, email_verified, is_active, scope, tenant_id, created_at)
        VALUES 
          ('88888888-8888-8888-8888-888888888888', 'user-a@test.com', $1, 'User A', true, true, 'tenant_admin', $2, NOW()),
          ('99999999-9999-9999-9999-999999999999', 'user-b@test.com', $3, 'User B', true, true, 'tenant_admin', $4, NOW())
        ON CONFLICT (id) DO UPDATE SET
          password_hash = EXCLUDED.password_hash,
          scope = EXCLUDED.scope,
          tenant_id = EXCLUDED.tenant_id
      `, ['unused-hash-a', tenantAId, 'unused-hash-b', tenantBId]);

      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    // Mint access tokens directly (see the seeding comment above for why
    // the login flow is bypassed).
    const mintToken = (userId: string, email: string, tenantId: string): string =>
      jwt.sign(
        { userId, email, scope: 'tenant_admin', roles: ['admin'], tokenVersion: 0, tenantId },
        process.env.JWT_SECRET as string,
        { expiresIn: '1h' },
      );
    userAToken = mintToken('88888888-8888-8888-8888-888888888888', 'user-a@test.com', tenantAId);
    userBToken = mintToken('99999999-9999-9999-9999-999999999999', 'user-b@test.com', tenantBId);
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
          'X-Tenant-ID': tenantAId,
          'X-Property-Id': propertyAId
        },
        body: JSON.stringify({
          catalogItemId: catalogItemAId,
          quantityRequired: 1
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
          'X-Tenant-ID': tenantBId,
          'X-Property-Id': propertyBId
        },
        body: JSON.stringify({
          catalogItemId: catalogItemBId,
          quantityRequired: 1
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
          'X-Tenant-ID': tenantAId,
          'X-Property-Id': propertyAId
        },
        body: JSON.stringify({
          catalogItemId: catalogItemAId,
          quantityRequired: 1
        })
      });

      expect(res.ok, `link-menu failed: ${res.status} ${JSON.stringify(await res.json().catch(() => null)).slice(0, 300)}`).toBe(true);
    });
  });
});
