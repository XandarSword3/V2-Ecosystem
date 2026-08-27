/**
 * Phase 8: Catalog lifecycle transition graph — integration tests.
 *
 * Proves:
 *   1. Legal transitions succeed
 *   2. Invalid transitions are rejected with 400
 *   3. Terminal states (sold_out, archived) have no outgoing transitions
 *   4. Customer menu hides non-active products
 *   5. Staff menu shows active + temporarily_unavailable
 *
 * Requires RUN_INTEGRATION_TESTS=true and a real reachable database.
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import app from '../../src/app';
import { getSupabase } from '../../src/database/supabase';
import { loadDynamicModules } from '../../src/routes/dynamic-modules.loader';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration('Catalog lifecycle (Integration)', () => {
  const supabase = getSupabase();

  let tenantId: string;
  let propertyId: string;
  let moduleId: string;
  let moduleSlug: string;
  let catalogItemId: string;
  let staffToken: string;

  const staffPassword = 'LifecycleTest123!';

  beforeAll(async () => {
    // Create tenant + property
    const { data: tenant } = await supabase
      .from('tenants')
      .insert({ subdomain: `lc-${randomUUID().slice(0, 8)}` })
      .select('id')
      .single();
    tenantId = tenant!.id;

    const { data: property } = await supabase
      .from('properties')
      .insert({ name: 'LC Property', tenant_id: tenantId })
      .select('id')
      .single();
    propertyId = property!.id;

    // Create module
    moduleSlug = `lc-${randomUUID().slice(0, 8)}`;
    const { data: mod } = await supabase
      .from('modules')
      .insert({
        name: 'LC Kitchen',
        slug: moduleSlug,
        engine_type: 'instant_transaction',
        tenant_id: tenantId,
        property_id: propertyId,
        is_active: true,
      })
      .select('id')
      .single();
    moduleId = mod!.id;

    // Create staff user (same pattern as engine-a lifecycle test)
    const email = `lc-staff-${randomUUID().slice(0, 8)}@test.com`;
    const passwordHash = await bcrypt.hash(staffPassword, 12);
    const { data: user } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        full_name: 'LC Staff',
        scope: 'property_staff',
        roles: ['staff'],
        tenant_id: tenantId,
        token_version: 0,
        is_active: true,
        email_verified: true,
      })
      .select('id')
      .single();

    await supabase
      .from('user_property_access')
      .insert({ user_id: user!.id, property_id: propertyId, tenant_id: tenantId, access_level: 'staff' });

    // Login
    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Tenant-ID', tenantId)
      .send({ email, password: staffPassword });
    staffToken = loginRes.body.data?.accessToken || loginRes.body.data?.tokens?.accessToken;

    // Load dynamic module routes so /:slug/* endpoints are mounted
    await loadDynamicModules();

    // Create a catalog item (starts as 'active' by default)
    const createItem = await request(app)
      .post(`/api/v1/${moduleSlug}/admin/items`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ name: 'Lifecycle Burger', price: 12.00 });
    expect(createItem.status).toBe(201);
    catalogItemId = createItem.body.data.id;
  });

  afterAll(async () => {
    await supabase.from('catalog_items').delete().eq('id', catalogItemId);
    await supabase.from('modules').delete().eq('id', moduleId);
    await supabase.from('properties').delete().eq('id', propertyId);
    await supabase.from('tenants').delete().eq('id', tenantId);
  });

  // ── Legal transitions ────────────────────────────────────────────

  it('1. active → temporarily_unavailable succeeds', async () => {
    const res = await request(app)
      .put(`/api/v1/${moduleSlug}/admin/items/${catalogItemId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ lifecycle_status: 'temporarily_unavailable' });
    expect(res.status).toBe(200);
    expect(res.body.data.lifecycle_status).toBe('temporarily_unavailable');
  });

  it('2. temporarily_unavailable → active (restore) succeeds', async () => {
    const res = await request(app)
      .put(`/api/v1/${moduleSlug}/admin/items/${catalogItemId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ lifecycle_status: 'active' });
    expect(res.status).toBe(200);
    expect(res.body.data.lifecycle_status).toBe('active');
  });

  it('3. active → sold_out succeeds', async () => {
    const res = await request(app)
      .put(`/api/v1/${moduleSlug}/admin/items/${catalogItemId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ lifecycle_status: 'sold_out' });
    expect(res.status).toBe(200);
    expect(res.body.data.lifecycle_status).toBe('sold_out');
  });

  // ── Invalid transitions ──────────────────────────────────────────

  it('4. sold_out → active is rejected (terminal state)', async () => {
    const res = await request(app)
      .put(`/api/v1/${moduleSlug}/admin/items/${catalogItemId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ lifecycle_status: 'active' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid lifecycle transition');
  });

  it('5. sold_out → draft is rejected', async () => {
    const res = await request(app)
      .put(`/api/v1/${moduleSlug}/admin/items/${catalogItemId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ lifecycle_status: 'draft' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid lifecycle transition');
  });

  it('6. sold_out → archived is rejected (terminal state)', async () => {
    const res = await request(app)
      .put(`/api/v1/${moduleSlug}/admin/items/${catalogItemId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ lifecycle_status: 'archived' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid lifecycle transition');
  });

  // ── Reset for archival test ──────────────────────────────────────

  it('7. reset to active for archival test', async () => {
    await supabase.from('catalog_items').delete().eq('id', catalogItemId);
    const createItem = await request(app)
      .post(`/api/v1/${moduleSlug}/admin/items`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ name: 'Lifecycle Burger v2', price: 14.00 });
    expect(createItem.status).toBe(201);
    catalogItemId = createItem.body.data.id;
  });

  // ── Archive ──────────────────────────────────────────────────────

  it('8. active → archived succeeds', async () => {
    const res = await request(app)
      .put(`/api/v1/${moduleSlug}/admin/items/${catalogItemId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ lifecycle_status: 'archived' });
    expect(res.status).toBe(200);
    expect(res.body.data.lifecycle_status).toBe('archived');
  });

  it('9. archived → active is rejected (terminal state)', async () => {
    const res = await request(app)
      .put(`/api/v1/${moduleSlug}/admin/items/${catalogItemId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ lifecycle_status: 'active' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Invalid lifecycle transition');
  });

  // ── Customer menu visibility ─────────────────────────────────────

  it('10. customer menu hides non-active products', async () => {
    // Reset item to active.
    await supabase.from('catalog_items').delete().eq('id', catalogItemId);
    const createItem = await request(app)
      .post(`/api/v1/${moduleSlug}/admin/items`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ name: 'Visible Burger', price: 10.00 });
    catalogItemId = createItem.body.data.id;

    // Customer sees active items (auth required by global middleware).
    const activeRes = await request(app)
      .get(`/api/v1/${moduleSlug}/items`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId);
    expect(activeRes.status).toBe(200);
    const activeIds = activeRes.body.data.map((i: any) => i.id);
    expect(activeIds).toContain(catalogItemId);

    // Set to temporarily_unavailable.
    await request(app)
      .put(`/api/v1/${moduleSlug}/admin/items/${catalogItemId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ lifecycle_status: 'temporarily_unavailable' });

    // Customer does NOT see temporarily_unavailable items.
    const unavailRes = await request(app)
      .get(`/api/v1/${moduleSlug}/items`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId);
    expect(unavailRes.status).toBe(200);
    const unavailIds = unavailRes.body.data.map((i: any) => i.id);
    expect(unavailIds).not.toContain(catalogItemId);
  });

  // ── Staff menu visibility ────────────────────────────────────────

  it('11. staff menu shows active + temporarily_unavailable items', async () => {
    // Item is temporarily_unavailable from previous test.
    const staffRes = await request(app)
      .get(`/api/v1/staff/modules/${moduleSlug}/menu`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId);
    expect(staffRes.status).toBe(200);
    const staffItemIds = (staffRes.body.data?.items || []).map((i: any) => i.id);
    expect(staffItemIds).toContain(catalogItemId);

    // Set to sold_out.
    await request(app)
      .put(`/api/v1/${moduleSlug}/admin/items/${catalogItemId}`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ lifecycle_status: 'sold_out' });

    // Staff should NOT see sold_out items.
    const soldOutRes = await request(app)
      .get(`/api/v1/staff/modules/${moduleSlug}/menu`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId);
    const soldOutIds = (soldOutRes.body.data?.items || []).map((i: any) => i.id);
    expect(soldOutIds).not.toContain(catalogItemId);
  });
});
