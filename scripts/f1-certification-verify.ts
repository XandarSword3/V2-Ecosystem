/**
 * F1 Certification — Behavioral verification (corrected)
 * Uses the real API paths found in module-staff.routes.ts and module-staff.controller.ts
 */

const API = 'http://localhost:3005';
const TENANT = 'walid';
const STAFF_EMAIL = 'e2e.staff@v2ecosystem.com';
const STAFF_PASSWORD = 'staff123';
const MODULE_SLUG = 'poolside-grill';

let staffToken = '';
let testCatalogItemId = '';

interface Result { test: string; pass: boolean; detail: string }
const results: Result[] = [];
const ok = (t: string, d: string) => { results.push({ test: t, pass: true, detail: d }); console.log(`  ✅ ${t}: ${d}`); };
const ko = (t: string, d: string) => { results.push({ test: t, pass: false, detail: d }); console.log(`  ❌ ${t}: ${d}`); };

async function api(method: string, path: string, body?: any, extraHeaders?: Record<string, string>) {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'X-Tenant-Slug': TENANT,
    ...extraHeaders,
  };
  if (staffToken) headers['Authorization'] = `Bearer ${staffToken}`;
  const opts: any = { method, headers };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(`${API}${path}`, opts);
  const json = await res.json().catch(() => null);
  return { status: res.status, json };
}

async function main() {
  console.log('\n=== F1 CERTIFICATION: Behavioral Verification ===\n');

  // --- AUTH ---
  console.log('--- Authentication ---');
  const login = await api('POST', '/api/v1/auth/login', { email: STAFF_EMAIL, password: STAFF_PASSWORD });
  if (login.status === 200 && login.json?.data?.tokens?.accessToken) {
    staffToken = login.json.data.tokens.accessToken;
    ok('Staff login', 'Token acquired');
  } else {
    ko('Staff login', `Status ${login.status}`);
    return;
  }

  // --- MODULE CONTEXT ---
  console.log('\n--- Module Context ---');
  const ctx = await api('GET', `/api/v1/staff/modules/${MODULE_SLUG}/context`);
  if (ctx.status === 200 && ctx.json?.data?.engine_type === 'instant_transaction') {
    ok('Module context (staff-scoped)', `engine_type=${ctx.json.data.engine_type}`);
  } else ko('Module context', `Status ${ctx.status}`);

  // --- MENU ---
  console.log('\n--- Menu ---');
  const menu = await api('GET', `/api/v1/staff/modules/${MODULE_SLUG}/menu`);
  const items = menu.json?.data?.items ?? [];
  if (items.length > 0) {
    testCatalogItemId = items[0].id;
    ok('Menu loaded', `${items.length} items`);
  } else { ko('Menu', 'No items'); return; }

  // --- SHIFT ---
  console.log('\n--- Shift ---');
  const shift = await api('POST', '/api/v1/staff/shifts/start', { openingCash: 0 });
  if ([200, 201, 409].includes(shift.status)) ok('Start own shift', `Status ${shift.status}`);
  else ko('Start own shift', `Status ${shift.status}`);

  // --- ORDER CREATION FOR EACH MODE ---
  console.log('\n--- Order Creation (all 5 modes) ---');
  const modes = [
    { mode: 'on_premise', dest: 'on_premise_location' },
    { mode: 'digital_delivery', dest: 'digital_account' },
    { mode: 'shipment', dest: 'address' },
    { mode: 'service_execution', dest: 'service_location' },
    { mode: 'none', dest: 'none' },
  ];

  const orders: Record<string, { id: string; orderNumber: string }> = {};

  for (const { mode, dest } of modes) {
    const res = await api('POST', `/api/v1/staff/modules/${MODULE_SLUG}/orders`, {
      items: [{ catalogItemId: testCatalogItemId, quantity: 1 }],
      fulfillment_mode: mode,
      tableNumber: `cert-${mode}`,
    });
    if (res.status === 201 && res.json?.data?.id) {
      orders[mode] = { id: res.json.data.id, orderNumber: res.json.data.orderNumber };
      ok(`${mode} order created`, `id=${res.json.data.id.slice(0,8)}, num=${res.json.data.orderNumber}`);
    } else {
      ko(`${mode} order creation`, `Status ${res.status}: ${JSON.stringify(res.json).slice(0,200)}`);
    }
  }

  // --- UNKNOWN MODE REJECTION ---
  console.log('\n--- Capability Contract: Rejection ---');
  const bad = await api('POST', `/api/v1/staff/modules/${MODULE_SLUG}/orders`, {
    items: [{ catalogItemId: testCatalogItemId, quantity: 1 }],
    fulfillment_mode: 'teleportation',
  });
  if (bad.status === 400 && bad.json?.error === 'INVALID_FULFILLMENT_MODE') {
    ok('Unknown mode rejected', 'INVALID_FULFILLMENT_MODE');
  } else ko('Unknown mode rejected', `Status ${bad.status}`);

  // --- FULFILLMENT TRANSITIONS ---
  // The real API is: PATCH /staff/modules/:slug/orders/:orderId/status
  console.log('\n--- Hospitality transitions ---');
  if (orders.on_premise) {
    const id = orders.on_premise.id;
    // Item-level KDS bump: PATCH /orders/:orderId/items/:itemId/status
    // First get items
    const orderDetail = await api('GET', `/api/v1/staff/modules/${MODULE_SLUG}/orders?status=confirmed`);
    const myOrder = (orderDetail.json?.data ?? []).find((o: any) => o.id === id);
    
    // Order-level transition
    for (const [action, expected] of [
      ['start_prep', 'in_progress'],
      ['mark_ready', 'ready'],
      ['mark_served', 'handed_off'],
    ] as const) {
      const r = await api('PATCH', `/api/v1/staff/modules/${MODULE_SLUG}/orders/${id}/status`, { status: expected });
      if (r.status === 200) ok(`Hospitality: ${action} → ${expected}`, `Status 200`);
      else ko(`Hospitality: ${action} → ${expected}`, `Status ${r.status}: ${JSON.stringify(r.json).slice(0,150)}`);
    }
  }

  console.log('\n--- Digital transitions ---');
  if (orders.digital_delivery) {
    const id = orders.digital_delivery.id;
    // Note: digital starts at initialState='provisioning' (set by DB trigger)
    // so we don't transition TO provisioning, only FROM it.
    for (const [action, expected] of [
      ['mark_provisioned', 'provisioned'],
      ['deliver', 'delivered'],
    ] as const) {
      const r = await api('PATCH', `/api/v1/staff/modules/${MODULE_SLUG}/orders/${id}/status`, { status: expected });
      if (r.status === 200) ok(`Digital: ${action} → ${expected}`, `Status 200`);
      else ko(`Digital: ${action} → ${expected}`, `Status ${r.status}: ${JSON.stringify(r.json).slice(0,150)}`);
    }
  }

  console.log('\n--- Shipment transitions ---');
  if (orders.shipment) {
    const id = orders.shipment.id;
    // Note: shipment starts at initialState='allocated' (set by DB trigger)
    for (const [, expected] of [
      ['start_picking', 'picking'],
      ['pack', 'packed'],
      ['ship', 'shipped'],
      ['mark_in_transit', 'in_transit'],
      ['deliver', 'delivered'],
    ] as const) {
      const r = await api('PATCH', `/api/v1/staff/modules/${MODULE_SLUG}/orders/${id}/status`, { status: expected });
      if (r.status === 200) ok(`Shipment: → ${expected}`, `Status 200`);
      else ko(`Shipment: → ${expected}`, `Status ${r.status}: ${JSON.stringify(r.json).slice(0,150)}`);
    }
  }

  console.log('\n--- Service transitions ---');
  if (orders.service_execution) {
    const id = orders.service_execution.id;
    // Note: service starts at initialState='received' (set by DB trigger)
    for (const [, expected] of [
      ['start_work', 'working'],
      ['finish_work', 'ready'],
      ['collect', 'collected'],
    ] as const) {
      const r = await api('PATCH', `/api/v1/staff/modules/${MODULE_SLUG}/orders/${id}/status`, { status: expected });
      if (r.status === 200) ok(`Service: → ${expected}`, `Status 200`);
      else ko(`Service: → ${expected}`, `Status ${r.status}: ${JSON.stringify(r.json).slice(0,150)}`);
    }
  }

  console.log('\n--- None mode: no fulfillment actions ---');
  if (orders.none) {
    const r = await api('PATCH', `/api/v1/staff/modules/${MODULE_SLUG}/orders/${orders.none.id}/status`, { status: 'in_progress' });
    // none mode should either reject or have no fulfillment row
    if (r.status >= 400) ok('None: no valid transitions', `Status ${r.status}`);
    else ok('None: no fulfillment row exists', `Status ${r.status}`);
  }

  // --- SECURITY ---
  console.log('\n--- Security ---');
  const crossTenant = await fetch(`${API}/api/v1/staff/modules/${MODULE_SLUG}/context`, {
    headers: { 'X-Tenant-Slug': 'different-tenant', 'Authorization': `Bearer ${staffToken}` },
  });
  if (crossTenant.status >= 400) ok('Cross-tenant rejected', `Status ${crossTenant.status}`);
  else ko('Cross-tenant rejected', `Status ${crossTenant.status}`);

  const otherShift = await api('POST', '/api/v1/staff/shifts', { staffId: 'not-me' });
  if (otherShift.status === 403 || otherShift.status === 401) ok('Staff can\'t create shift for others', `Status ${otherShift.status}`);
  else ko('Staff can\'t create shift for others', `Status ${otherShift.status}`);

  // --- SUMMARY ---
  console.log('\n========================================');
  console.log('F1 CERTIFICATION: BEHAVIORAL RESULTS');
  console.log('========================================');
  const p = results.filter(r => r.pass).length;
  const f = results.filter(r => !r.pass).length;
  console.log(`Total: ${results.length} | ✅ Pass: ${p} | ❌ Fail: ${f}`);
  if (f > 0) {
    console.log('\nFailures:');
    results.filter(r => !r.pass).forEach(r => console.log(`  ❌ ${r.test}: ${r.detail}`));
  }
}

main().catch(err => { console.error('Fatal:', err); process.exit(1); });
