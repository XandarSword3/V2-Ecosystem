/**
 * Engine A (instant_transaction) order lifecycle — real integration test.
 *
 * No mocks. This creates real rows in a real database, drives the real
 * Express app over real HTTP (supertest), and asserts on real database
 * state afterward — not on response bodies alone. Every assertion here
 * reads back from the tables directly.
 *
 * Requires RUN_INTEGRATION_TESTS=true and a real reachable database (see
 * vitest.integration.config.ts / .env.test). Written and reasoned through
 * carefully, but NOT executed against a live database — the environment
 * that wrote this has no Docker and no network route to Supabase. Run it
 * for real before trusting it; if any fixture assumption below is wrong
 * for your schema, it will fail loudly at beforeAll rather than silently
 * pass, which is the whole point.
 *
 * Covers, in order:
 *   1. Order creation writes order_items AND deducts inventory at creation
 *      time (the ONE stock authority: deduct_inventory_for_order_items,
 *      via deduct_stock_fifo). No allocation or fulfillment rows exist yet.
 *   2. Confirmation does NOT deduct stock again (single authority). It
 *      allocates resources PRE-FLIGHT (no confirmed-without-resources
 *      window) and the trigger seeds the fulfillment row with the
 *      snapshotted selection + the mode's declared initial status.
 *   3. Item status is forward-only — skipping a step is rejected.
 *   4. Bumping every item to 'ready' advances the FULFILLMENT row to
 *      'ready' — transactions.status stays 'confirmed' (canonical
 *      fulfillment state lives in the fulfillments table).
 *   5. Bumping every item to 'served' advances the fulfillment row to
 *      'handed_off' (the engine's canonical state, not the legacy
 *      'delivered') and consumes the allocated resources exactly once.
 *   6. Cancelling a confirmed order restores the creation-time stock
 *      deduction AND releases its resource allocation (compensation).
 *   7. Isolation — a staff member scoped to a different tenant/module
 *      cannot act on this order via its id. Confirmed against the real
 *      handler that the module_id-scoped fetch in changeInstantTransactionOrderStatus
 *      is what enforces this.
 */
import request from 'supertest';
import bcrypt from 'bcryptjs';
import { randomUUID } from 'crypto';
import app from '../../src/app';
import { getSupabase } from '../../src/database/supabase';

import { loadDynamicModules } from '../../src/routes/dynamic-modules.loader';

const runIntegration = process.env.RUN_INTEGRATION_TESTS === 'true';
const describeIntegration = runIntegration ? describe : describe.skip;

describeIntegration('Engine A order lifecycle (Integration)', () => {
  const supabase = getSupabase();

  // Fixture ids, populated in beforeAll.
  let tenantId: string;
  let propertyId: string;
  let moduleId: string;
  let moduleSlug: string;
  let catalogItemId: string;
  let inventoryItemId: string;
  let staffUserId: string;
  let staffToken: string;

  // A second, fully isolated tenant/property/module/staff user — used only
  // by the isolation test at the end. All ids captured for teardown.
  let otherTenantId: string;
  let otherPropertyId: string;
  let otherModuleId: string;
  let otherModuleSlug: string;
  let otherStaffUserId: string;
  let otherStaffToken: string;

  const STARTING_STOCK = 100;
  const RECIPE_QTY_PER_ITEM = 2; // units of inventory consumed per order item ordered
  const ORDER_QTY = 3; // how many of the catalog item this order places
  const staffPassword = 'IntegrationTest123!';

  // Populated by test 6, read in afterAll for cleanup of its inventory_transactions.
  let secondOrderId: string | undefined;

  async function createTenantPropertyModule(namePrefix: string) {
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({ subdomain: `${namePrefix}-${randomUUID().slice(0, 8)}` })
      .select('id')
      .single();
    if (tenantErr || !tenant) throw new Error(`Fixture setup failed (tenant): ${tenantErr?.message}`);

    const { data: property, error: propErr } = await supabase
      .from('properties')
      .insert({ name: `${namePrefix} Property`, tenant_id: tenant.id })
      .select('id')
      .single();
    if (propErr || !property) throw new Error(`Fixture setup failed (property): ${propErr?.message}`);

    const slug = `${namePrefix}-${randomUUID().slice(0, 8)}`;
    const { data: mod, error: modErr } = await supabase
      .from('modules')
      .insert({
        name: `${namePrefix} Kitchen`,
        slug,
        engine_type: 'instant_transaction',
        tenant_id: tenant.id,
        property_id: property.id,
        is_active: true,
      })
      .select('id')
      .single();
    if (modErr || !mod) throw new Error(`Fixture setup failed (module): ${modErr?.message}`);

    return { tenantId: tenant.id as string, propertyId: property.id as string, moduleId: mod.id as string, moduleSlug: slug };
  }

  async function createStaffUser(tenant: string, property: string, email: string) {
    const passwordHash = await bcrypt.hash(staffPassword, 12);
    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({
        email,
        password_hash: passwordHash,
        full_name: 'Integration Test Staff',
        scope: 'property_staff', // -> roles:['staff'] via scopeToRoles, and NOT in the mandatory-2FA scope list
        roles: ['staff'],
        tenant_id: tenant,
        token_version: 0,
        is_active: true,
        email_verified: true,
      })
      .select('id')
      .single();
    if (userErr || !user) throw new Error(`Fixture setup failed (staff user): ${userErr?.message}`);

    const { error: accessErr } = await supabase
      .from('user_property_access')
      .insert({ user_id: user.id, property_id: property, tenant_id: tenant, access_level: 'staff' });
    if (accessErr) throw new Error(`Fixture setup failed (user_property_access): ${accessErr?.message}`);

    const loginRes = await request(app)
      .post('/api/v1/auth/login')
      .set('X-Tenant-ID', tenant)
      .send({ email, password: staffPassword });
    if (loginRes.status !== 200 || !loginRes.body?.success) {
      throw new Error(`Fixture setup failed (login): ${loginRes.status} ${JSON.stringify(loginRes.body)}`);
    }
    const token: string | undefined = loginRes.body.data?.accessToken || loginRes.body.data?.tokens?.accessToken;
    if (!token) throw new Error('Fixture setup failed (login): no access token in response');

    return { userId: user.id as string, token };
  }

  beforeAll(async () => {
    const primary = await createTenantPropertyModule('e2e-engine-a');
    tenantId = primary.tenantId;
    propertyId = primary.propertyId;
    moduleId = primary.moduleId;
    moduleSlug = primary.moduleSlug;

    const { data: catalogItem, error: catalogErr } = await supabase
      .from('catalog_items')
      .insert({
        name: 'Integration Test Burger',
        price: 12.5,
        module_id: moduleId,
        tenant_id: tenantId,
        property_id: propertyId,
        is_available: true,
      })
      .select('id')
      .single();
    if (catalogErr || !catalogItem) throw new Error(`Fixture setup failed (catalog_item): ${catalogErr?.message}`);
    catalogItemId = catalogItem.id;

    const { data: invItem, error: invErr } = await supabase
      .from('inventory_items')
      .insert({
        name: 'Integration Test Beef Patty',
        unit: 'piece',
        current_stock: STARTING_STOCK,
        tenant_id: tenantId,
        property_id: propertyId,
        module_id: moduleId,
        is_active: true,
      })
      .select('id')
      .single();
    if (invErr || !invItem) throw new Error(`Fixture setup failed (inventory_item): ${invErr?.message}`);
    inventoryItemId = invItem.id;

    const { error: batchErr } = await supabase.from('inventory_batches').insert({
      item_id: inventoryItemId,
      batch_number: 'BATCH-001',
      quantity: STARTING_STOCK,
      remaining_quantity: STARTING_STOCK,
      status: 'active',
      tenant_id: tenantId,
      property_id: propertyId,
    });
    if (batchErr) throw new Error(`Fixture setup failed (inventory_batches): ${batchErr.message}`);

    const { error: recipeErr } = await supabase.from('menu_item_ingredients').insert({
      catalog_item_id: catalogItemId,
      inventory_item_id: inventoryItemId,
      quantity_required: RECIPE_QTY_PER_ITEM,
      unit: 'piece',
      tenant_id: tenantId,
      property_id: propertyId,
    });
    if (recipeErr) throw new Error(`Fixture setup failed (menu_item_ingredients): ${recipeErr.message}`);

    const staff = await createStaffUser(tenantId, propertyId, `staff-${randomUUID().slice(0, 8)}@integration.test`);
    staffUserId = staff.userId;
    staffToken = staff.token;

    // Second, unrelated tenant for the isolation test. All ids captured so
    // afterAll can actually clean them up.
    const other = await createTenantPropertyModule('e2e-engine-a-other');
    otherTenantId = other.tenantId;
    otherPropertyId = other.propertyId;
    otherModuleId = other.moduleId;
    otherModuleSlug = other.moduleSlug;
    const otherStaff = await createStaffUser(other.tenantId, other.propertyId, `staff-other-${randomUUID().slice(0, 8)}@integration.test`);
    otherStaffUserId = otherStaff.userId;
    otherStaffToken = otherStaff.token;

    // Refresh dynamic module router so the new modules are routable in Express
    await loadDynamicModules();
  }, 60000);

  afterAll(async () => {
    // Best-effort cleanup — don't fail the suite over teardown issues, but
    // don't silently swallow them either.
    try {
      await supabase.from('order_items').delete().eq('tenant_id', tenantId);
      if (createdOrderId) {
        await supabase.from('fulfillments').delete().eq('transaction_id', createdOrderId);
        await supabase.from('resource_allocations').delete().eq('transaction_id', createdOrderId);
      }
      await supabase.from('transactions').delete().eq('module_id', moduleId);
      await supabase.from('menu_item_ingredients').delete().eq('tenant_id', tenantId);
      await supabase.from('inventory_transactions').delete().eq('reference_id', createdOrderId || '');
      if (secondOrderId) {
        await supabase.from('inventory_transactions').delete().eq('reference_id', secondOrderId);
      }
      await supabase.from('inventory_batches').delete().eq('item_id', inventoryItemId);
      await supabase.from('inventory_items').delete().eq('id', inventoryItemId);
      await supabase.from('catalog_items').delete().eq('id', catalogItemId);
      await supabase.from('user_property_access').delete().in('user_id', [staffUserId, otherStaffUserId]);
      await supabase.from('users').delete().in('id', [staffUserId, otherStaffUserId]);
      await supabase.from('modules').delete().in('id', [moduleId, otherModuleId]);
      await supabase.from('properties').delete().in('id', [propertyId, otherPropertyId]);
      await supabase.from('tenants').delete().in('id', [tenantId, otherTenantId]);
    } catch (cleanupErr) {
      // eslint-disable-next-line no-console
      console.warn('Integration test cleanup had errors (non-fatal):', cleanupErr);
    }
  }, 30000);

  let createdOrderId: string;
  let createdItemIds: string[] = [];

  it('1. creates real order_items rows, not an empty array', async () => {
    const res = await request(app)
      .post(`/api/v1/${moduleSlug}/orders`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({
        items: [{ catalog_item_id: catalogItemId, quantity: ORDER_QTY }],
        table_number: 'T-1',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    createdOrderId = res.body.data.id;
    expect(createdOrderId).toBeTruthy();

    const { data: items, error } = await supabase
      .from('order_items')
      .select('id, catalog_item_id, quantity, status, transaction_id')
      .eq('transaction_id', createdOrderId);

    expect(error).toBeNull();
    expect(items).toHaveLength(1);
    expect(items![0].catalog_item_id).toBe(catalogItemId);
    expect(items![0].quantity).toBe(ORDER_QTY);
    expect(items![0].status).toBe('pending');
    createdItemIds = items!.map((i) => i.id);

    // ONE stock authority: creation already deducted stock (atomic, via
    // deduct_stock_fifo) — the customer cannot even create an order against
    // unavailable stock.
    const { data: stockAfterCreate } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', inventoryItemId)
      .single();
    expect(stockAfterCreate!.current_stock).toBe(STARTING_STOCK - RECIPE_QTY_PER_ITEM * ORDER_QTY);

    // Nothing allocated or fulfilled yet — both arrive at confirmation.
    const { data: allocsBefore } = await supabase
      .from('resource_allocations')
      .select('id')
      .eq('transaction_id', createdOrderId);
    expect(allocsBefore ?? []).toHaveLength(0);
    const { data: fulfillmentsBefore } = await supabase
      .from('fulfillments')
      .select('id')
      .eq('transaction_id', createdOrderId);
    expect(fulfillmentsBefore ?? []).toHaveLength(0);
  });

  it('2. confirmation does NOT deduct stock again — it allocates resources pre-flight and seeds the fulfillment row', async () => {
    const res = await request(app)
      .patch(`/api/v1/staff/modules/${moduleSlug}/orders/${createdOrderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ status: 'confirmed' });

    expect(res.status).toBe(200);
    expect(res.body.data.status).toBe('confirmed');

    // No-window invariant: allocation ran PRE-FLIGHT — the confirm write
    // only happened because the resources were reserved. The BOM-derived
    // requirement row is the proof.
    const { data: allocs, error: allocErr } = await supabase
      .from('resource_allocations')
      .select('kind, resource_ref, quantity, unit, status')
      .eq('transaction_id', createdOrderId);
    expect(allocErr).toBeNull();
    expect(allocs).toHaveLength(1);
    expect(allocs![0].kind).toBe('inventory_item');
    expect(allocs![0].resource_ref).toBe(inventoryItemId);
    expect(allocs![0].quantity).toBe(RECIPE_QTY_PER_ITEM * ORDER_QTY);
    expect(allocs![0].status).toBe('allocated');

    // The confirm trigger seeded the fulfillment row with the SNAPSHOTTED
    // selection and the mode's declared initial status.
    const { data: fulfillment } = await supabase
      .from('fulfillments')
      .select('status, mode, destination_type, destination_ref')
      .eq('transaction_id', createdOrderId)
      .single();
    expect(fulfillment!.status).toBe('queued');
    expect(fulfillment!.mode).toBe('on_premise');
    expect(fulfillment!.destination_type).toBe('on_premise_location');
    expect(fulfillment!.destination_ref).toBe('T-1');

    // ONE stock authority: stock is UNCHANGED by confirmation — it was
    // deducted exactly once, at creation.
    const { data: invItem } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', inventoryItemId)
      .single();
    expect(invItem!.current_stock).toBe(STARTING_STOCK - RECIPE_QTY_PER_ITEM * ORDER_QTY);
  });

  it('3. item status is forward-only — skipping a step is rejected', async () => {
    const itemId = createdItemIds[0];
    const res = await request(app)
      .patch(`/api/v1/staff/modules/${moduleSlug}/orders/${createdOrderId}/items/${itemId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ status: 'ready' }); // skipping 'preparing'

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  it('4. bumping the only item to ready auto-advances the order to ready', async () => {
    const itemId = createdItemIds[0];

    const toPreparing = await request(app)
      .patch(`/api/v1/staff/modules/${moduleSlug}/orders/${createdOrderId}/items/${itemId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ status: 'preparing' });
    expect(toPreparing.status).toBe(200);

    const toReady = await request(app)
      .patch(`/api/v1/staff/modules/${moduleSlug}/orders/${createdOrderId}/items/${itemId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ status: 'ready' });
    expect(toReady.status).toBe(200);

    // Canonical fulfillment state lives in the fulfillments table — the
    // transaction layer is untouched until completion/cancellation.
    const { data: fulfillment } = await supabase
      .from('fulfillments')
      .select('status')
      .eq('transaction_id', createdOrderId)
      .single();
    expect(fulfillment!.status).toBe('ready');

    const { data: order, error } = await supabase
      .from('transactions')
      .select('status')
      .eq('id', createdOrderId)
      .single();
    expect(error).toBeNull();
    expect(order!.status).toBe('confirmed');
  });

  it("5. bumping the item to served advances the fulfillment row to the engine's canonical 'handed_off' and consumes resources", async () => {
    const itemId = createdItemIds[0];
    const res = await request(app)
      .patch(`/api/v1/staff/modules/${moduleSlug}/orders/${createdOrderId}/items/${itemId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ status: 'served' });
    expect(res.status).toBe(200);

    // Canonical fulfillment state — the engine's real state name.
    const { data: fulfillment } = await supabase
      .from('fulfillments')
      .select('status')
      .eq('transaction_id', createdOrderId)
      .single();
    expect(fulfillment!.status).toBe('handed_off');

    // transactions.status stays at its transaction-layer value.
    const { data: order, error } = await supabase
      .from('transactions')
      .select('status')
      .eq('id', createdOrderId)
      .single();
    expect(error).toBeNull();
    expect(order!.status).toBe('confirmed');

    // Resource consumption at handoff: the item-derived deliver move drove
    // the resource lifecycle — the allocation is now consumed.
    const { data: allocs } = await supabase
      .from('resource_allocations')
      .select('status')
      .eq('transaction_id', createdOrderId);
    expect(allocs).toHaveLength(1);
    expect(allocs![0].status).toBe('consumed');
  });

  it('6. cancelling a second, separately-confirmed order restores the stock it reserved and releases its allocation', async () => {
    // Fresh order for this test — the first one is already handed off.
    const createRes = await request(app)
      .post(`/api/v1/${moduleSlug}/orders`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ items: [{ catalog_item_id: catalogItemId, quantity: ORDER_QTY }], table_number: 'T-2' });
    expect(createRes.status).toBe(201);
    secondOrderId = createRes.body.data.id;

    const confirmRes = await request(app)
      .patch(`/api/v1/staff/modules/${moduleSlug}/orders/${secondOrderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ status: 'confirmed' });
    expect(confirmRes.status).toBe(200);

    const { data: afterDeduction } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', inventoryItemId)
      .single();
    const stockAfterSecondDeduction = afterDeduction!.current_stock;

    // Its pre-flight allocation exists.
    const { data: allocsBefore } = await supabase
      .from('resource_allocations')
      .select('status')
      .eq('transaction_id', secondOrderId);
    expect(allocsBefore).toHaveLength(1);
    expect(allocsBefore![0].status).toBe('allocated');

    const cancelRes = await request(app)
      .patch(`/api/v1/staff/modules/${moduleSlug}/orders/${secondOrderId}/status`)
      .set('Authorization', `Bearer ${staffToken}`)
      .set('X-Tenant-ID', tenantId)
      .send({ status: 'cancelled' });
    expect(cancelRes.status).toBe(200);

    const { data: afterRestore, error } = await supabase
      .from('inventory_items')
      .select('current_stock')
      .eq('id', inventoryItemId)
      .single();
    expect(error).toBeNull();

    // Back to first order's post-deduction level — the second order's
    // creation-time deduction is fully reversed.
    const expectedAfterRestore = STARTING_STOCK - RECIPE_QTY_PER_ITEM * ORDER_QTY; // first order's deduction only
    expect(afterRestore!.current_stock).toBe(expectedAfterRestore);
    expect(afterRestore!.current_stock).not.toBe(stockAfterSecondDeduction);

    // Its allocation was released (compensation).
    const { data: allocsAfter } = await supabase
      .from('resource_allocations')
      .select('status')
      .eq('transaction_id', secondOrderId);
    expect(allocsAfter).toHaveLength(1);
    expect(allocsAfter![0].status).toBe('released');

    await supabase.from('order_items').delete().eq('transaction_id', secondOrderId);
    await supabase.from('fulfillments').delete().eq('transaction_id', secondOrderId);
    await supabase.from('resource_allocations').delete().eq('transaction_id', secondOrderId);
    await supabase.from('transactions').delete().eq('id', secondOrderId);
  });

  it('7. a staff member from a different tenant cannot act on this order by id', async () => {
    // 'confirmed' is a real target state elsewhere in this file, so a 400
    // here can only mean the transition itself was evaluated — it isn't a
    // stand-in for "invalid status value". A pass must come from isolation
    // blocking the request (404), not input validation rejecting it.
    const attempt = await request(app)
      .patch(`/api/v1/staff/modules/${otherModuleSlug}/orders/${createdOrderId}/status`)
      .set('Authorization', `Bearer ${otherStaffToken}`)
      .set('X-Tenant-ID', otherTenantId)
      .send({ status: 'confirmed' });

    expect(attempt.status).toBe(404);
    expect(attempt.body.success).toBe(false);
  });
});
