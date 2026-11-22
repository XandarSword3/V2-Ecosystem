/**
 * ProvisioningService unit tests
 *
 * Covers the Engine E Stripe→tenant provisioning path (previously 0% unit
 * coverage): idempotency, plan resolution (DB-first with fallback), the
 * property public_slug collision suffix loop, owner-user creation semantics
 * (scope='tenant_owner' is the authorization source of truth),
 * user_property_access, cache invalidation, welcome email, error paths, and
 * updateBillingStatus (including tier-driven plan re-resolution).
 */

import { createScriptedSupabase } from '../helpers/scripted-supabase';

const db = createScriptedSupabase();

vi.mock('../../../src/database/connection.js', () => ({
  getSupabase: () => db,
}));

vi.mock('bcryptjs', () => ({
  default: {
    hash: vi.fn().mockResolvedValue('$2a$12$test-hash'),
    compare: vi.fn(),
  },
}));

vi.mock('../../../src/services/password-policy.service.js', () => ({
  generateSecurePassword: vi.fn(() => 'TempPass123!'),
}));

vi.mock('../../../src/services/email.service.js', () => ({
  emailService: {
    sendEmail: vi.fn().mockResolvedValue(true),
  },
}));

vi.mock('../../../src/middleware/tenantAccess.middleware.js', () => ({
  invalidateTenantCache: vi.fn(),
  // Type imports only need the runtime names above; other exports unused.
}));

vi.mock('../../../src/utils/logger.js', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

// Deterministic, reversible encryption keeps the outbox assertions readable
// and independent of the ambient ENCRYPTION_KEY/JWT_SECRET.
vi.mock('../../../src/utils/encryption.js', () => ({
  encrypt: (v: string) => `enc(${v})`,
  decrypt: (v: string) => v.replace(/^enc\((.*)\)$/, '$1'),
}));

vi.mock('../../../src/utils/tenant-url.js', () => ({
  buildTenantUrl: vi.fn(() => 'https://acme.v2platform.com/login'),
}));

import { ProvisioningService } from '../../../src/modules/platform/provisioning.service.js';
import { invalidateTenantCache } from '../../../src/middleware/tenantAccess.middleware.js';
import { emailService } from '../../../src/services/email.service.js';

function baseInput(overrides: Record<string, unknown> = {}) {
  return {
    stripeSubscriptionId: 'sub_123',
    stripeCustomerId: 'cus_123',
    tier: 'starter',
    billingStatus: 'active',
    operatorEmail: 'owner@acme.com',
    operatorName: 'Alessandro',
    subdomain: 'acme',
    ...overrides,
  } as any;
}

const GROUP_ID = '11111111-2222-3333-4444-000000000001';
const PROPERTY_ID = '11111111-2222-3333-4444-000000000002';
const OWNER_ID = '11111111-2222-3333-4444-000000000003';

function queuesForFreshProvision(
  planRow: unknown = null,
  plansError: { message: string } | null = null,
  opts: { welcomeEmail?: boolean } = {},
) {
  // Idempotency check → no existing tenant
  db.queue('tenants:select', { data: null, error: null });
  // resolvePlanForTier
  db.queue('plans:select', plansError ? { data: planRow, error: plansError } : { data: planRow, error: null });
  // ensureTenantChildren: no group yet, then create one
  db.queue('property_groups:select', { data: null, error: null });
  db.queue('property_groups:insert', { data: { id: GROUP_ID }, error: null });
  // no default property yet, then slug availability check: no collision
  db.queue('properties:select', { data: null, error: null });
  db.queue('properties:select', { data: null, error: null });
  db.queue('properties:insert', { data: { id: PROPERTY_ID }, error: null });
  // no owner yet
  db.queue('users:select', { data: null, error: null });
  db.queue('users:insert', { data: { id: OWNER_ID }, error: null });
  // credential persisted before delivery
  db.queue('provisioning_email_outbox:upsert', { data: null, error: null });
  // no access grant yet
  db.queue('user_property_access:select', { data: null, error: null });
  db.queue('user_property_access:insert', { data: null, error: null });

  if (opts.welcomeEmail) {
    db.queue('provisioning_email_outbox:select', {
      data: [{
        id: 'outbox-1',
        tenant_id: 'tenant-1',
        recipient_email: 'owner@acme.com',
        recipient_name: 'Alessandro',
        subdomain: 'acme',
        temp_password_encrypted: 'enc(TempPass123!)',
        status: 'pending',
        attempts: 0,
      }],
      error: null,
    });
    db.queue('provisioning_email_outbox:update', { data: null, error: null });
  }
}

describe('ProvisioningService.provision', () => {
  let svc: ProvisioningService;

  beforeEach(() => {
    vi.clearAllMocks();
    db.reset();
    svc = new ProvisioningService();
  });

  it('creates tenant, group, property, owner and access — returns created:true ids', async () => {
    queuesForFreshProvision(
      { id: 'plan-starter', feature_limits: { maxProperties: 1 }, code: 'starter' },
      null,
      { welcomeEmail: true },
    );

    const result = await svc.provision(baseInput());
    await new Promise((r) => setTimeout(r, 0)); // let the fire-and-forget email land

    expect(result).toEqual({
      tenantId: expect.any(String),
      propertyGroupId: GROUP_ID,
      propertyId: PROPERTY_ID,
      ownerUserId: OWNER_ID,
      created: true,
    });

    const tenantInsert = db.calls.find((c) => c.table === 'tenants' && c.op === 'insert');
    expect(tenantInsert).toBeTruthy();
    expect(tenantInsert!.payload).toMatchObject({
      subdomain: 'acme',
      subscription_tier: 'starter',
      plan_id: 'plan-starter',
      billing_status: 'active',
      stripe_customer_id: 'cus_123',
      stripe_subscription_id: 'sub_123',
      feature_limits: { maxProperties: 1 },
    });
    // The tenant id returned must be the id actually inserted
    expect(tenantInsert!.payload).toHaveProperty('id', result.tenantId);

    const userInsert = db.calls.find((c) => c.table === 'users' && c.op === 'insert');
    expect(userInsert).toBeTruthy();
    expect(userInsert!.payload).toMatchObject({
      email: 'owner@acme.com',
      full_name: 'Alessandro',
      password_hash: '$2a$12$test-hash',
      email_verified: true,
      must_change_password: true,
      // The authorization source of truth: silently-becoming a 'customer'
      // was a real bug here — scope must be explicit.
      scope: 'tenant_owner',
    });

    const accessInsert = db.calls.find((c) => c.table === 'user_property_access' && c.op === 'insert');
    expect(accessInsert).toBeTruthy();
    expect(accessInsert!.payload).toMatchObject({ access_level: 'admin' });

    expect(invalidateTenantCache).toHaveBeenCalledWith(result.tenantId, 'acme');
    expect(emailService.sendEmail).toHaveBeenCalledTimes(1);
  });

  it('resolves the plan from the plans table (DB is the source of truth)', async () => {
    queuesForFreshProvision({ id: 'plan-9', feature_limits: { maxModules: -1, whiteLabel: true }, code: 'growth' });

    await svc.provision(baseInput({ tier: 'growth' }));

    const tenantInsert = db.calls.find((c) => c.table === 'tenants' && c.op === 'insert')!;
    expect(tenantInsert.payload).toMatchObject({
      plan_id: 'plan-9',
      feature_limits: { maxModules: -1, whiteLabel: true },
      subscription_tier: 'growth',
    });
  });

  it('falls back to hardcoded feature_limits (plan_id null) when no plan row exists', async () => {
    queuesForFreshProvision(null); // plans select → no row

    await svc.provision(baseInput());

    const tenantInsert = db.calls.find((c) => c.table === 'tenants' && c.op === 'insert')!;
    expect(tenantInsert.payload).toMatchObject({ plan_id: null });
    // starter fallback must include its documented limits
    expect((tenantInsert.payload as any).feature_limits.maxProperties).toBe(1);
  });

  it('falls back when the plans lookup errors (non-fatal)', async () => {
    queuesForFreshProvision(null, { message: 'Boom' });

    const result = await svc.provision(baseInput());
    expect(result.created).toBe(true);
    const tenantInsert = db.calls.find((c) => c.table === 'tenants' && c.op === 'insert')!;
    expect(tenantInsert.payload).toMatchObject({ plan_id: null });
  });

  it('suffixes the public_slug on collision (…-2), mirroring the backfill convention', async () => {
    db.queue('tenants:select', { data: null, error: null });
    db.queue('plans:select', { data: { id: 'p', feature_limits: {}, code: 'starter' }, error: null });
    db.queue('property_groups:select', { data: null, error: null });
    db.queue('property_groups:insert', { data: { id: GROUP_ID }, error: null });
    db.queue('properties:select', { data: null, error: null }); // no default property yet
    db.queue('properties:select', { data: { id: 'exists' }, error: null }); // first candidate taken
    db.queue('properties:select', { data: null, error: null }); // -2 free
    db.queue('properties:insert', { data: { id: PROPERTY_ID }, error: null });
    db.queue('users:select', { data: null, error: null });
    db.queue('users:insert', { data: { id: OWNER_ID }, error: null });
    db.queue('provisioning_email_outbox:upsert', { data: null, error: null });
    db.queue('user_property_access:select', { data: null, error: null });
    db.queue('user_property_access:insert', { data: null, error: null });

    await svc.provision(baseInput());

    const propertyInsert = db.calls.find((c) => c.table === 'properties' && c.op === 'insert')!;
    expect(propertyInsert.payload).toMatchObject({
      name: "Alessandro's Property",
      // "Alessandro's Property" → slug 'alessandro-s-property'; collision → '-2'
      public_slug: 'alessandro-s-property-2',
    });
  });

  it('ragged slugs are normalized: non-alphanumerics collapse to dashes, trimmed', async () => {
    queuesForFreshProvision(null);

    await svc.provision(baseInput({ operatorName: '  Renée & Co.  ' }));

    // Accents/whitespace/ampersands die via the [^a-z0-9] → '-' collapse and
    // the leading/trailing dash trim; what matters is the DNS-label shape.
    const propertyInsert = db.calls.find((c) => c.table === 'properties' && c.op === 'insert')!;
    expect(propertyInsert.payload).toMatchObject({ public_slug: expect.stringMatching(/^[a-z0-9][a-z0-9-]*$/) });
  });

  it('converges an already-provisioned tenant with no writes', async () => {
    db.queue('tenants:select', {
      data: { id: 't-existing', property_group_id: 'g-existing', subdomain: 'acme' },
      error: null,
    });
    // verify linked group
    db.queue('property_groups:select', { data: { id: 'g-existing' }, error: null });
    // existing default property
    db.queue('properties:select', { data: { id: 'p-existing' }, error: null });
    // existing owner
    db.queue('users:select', { data: { id: 'u-existing' }, error: null });
    // existing access grant — nothing to repair
    db.queue('user_property_access:select', { data: { id: 'a-existing' }, error: null });
    // no pending welcome email
    db.queue('provisioning_email_outbox:select', { data: [], error: null });

    const result = await svc.provision(baseInput());

    expect(result).toEqual({
      tenantId: 't-existing',
      propertyGroupId: 'g-existing',
      propertyId: 'p-existing',
      ownerUserId: 'u-existing',
      created: false,
    });

    // Fully provisioned: a retry is a pure read (no insert/update/delete)
    expect(db.calls.filter((c) => ['insert', 'update', 'delete'].includes(c.op)).map((c) => c.table))
      .toEqual([]);
    expect(emailService.sendEmail).not.toHaveBeenCalled();
    // No cache churn when nothing was repaired
    expect(invalidateTenantCache).not.toHaveBeenCalled();
  });

  it('repairs missing child rows when a previous attempt died half-way', async () => {
    // Tenant row exists but has no group link, group, property, owner or access.
    db.queue('tenants:select', {
      data: { id: 't-half', property_group_id: null, subdomain: 'acme' },
      error: null,
    });
    db.queue('property_groups:select', { data: null, error: null }); // no group for tenant
    db.queue('property_groups:insert', { data: { id: GROUP_ID }, error: null });
    db.queue('properties:select', { data: null, error: null }); // no property
    db.queue('properties:select', { data: null, error: null }); // slug free
    db.queue('properties:insert', { data: { id: PROPERTY_ID }, error: null });
    db.queue('users:select', { data: null, error: null }); // no owner
    db.queue('users:insert', { data: { id: OWNER_ID }, error: null });
    db.queue('provisioning_email_outbox:upsert', { data: null, error: null });
    db.queue('user_property_access:select', { data: null, error: null });
    db.queue('user_property_access:insert', { data: null, error: null });
    db.queue('provisioning_email_outbox:select', { data: [], error: null });

    const result = await svc.provision(baseInput());

    expect(result).toEqual({
      tenantId: 't-half',
      propertyGroupId: GROUP_ID,
      propertyId: PROPERTY_ID,
      ownerUserId: OWNER_ID,
      created: false,
    });
    expect(db.calls.find((c) => c.table === 'tenants' && c.op === 'update')).toBeTruthy();
    expect(db.calls.find((c) => c.table === 'user_property_access' && c.op === 'insert')).toBeTruthy();
    expect(invalidateTenantCache).toHaveBeenCalledWith('t-half', 'acme');
  });

  it('tenant insert failure throws (webhook must retry)', async () => {
    db.queue('tenants:select', { data: null, error: null });
    db.queue('plans:select', { data: null, error: null });
    db.queue('tenants:insert', { data: null, error: { message: 'duplicate subdomain' } });

    await expect(svc.provision(baseInput())).rejects.toThrow('[PROVISIONING] Failed to create tenant: duplicate subdomain');
  });

  it('property_group insert failure throws', async () => {
    db.queue('tenants:select', { data: null, error: null });
    db.queue('plans:select', { data: null, error: null });
    db.queue('property_groups:insert', { data: null, error: { message: 'fk broken' } });

    await expect(svc.provision(baseInput())).rejects.toThrow('Failed to create property_group: fk broken');
  });

  it('property insert failure throws', async () => {
    db.queue('tenants:select', { data: null, error: null });
    db.queue('plans:select', { data: null, error: null });
    db.queue('property_groups:insert', { data: { id: GROUP_ID }, error: null });
    // slug check
    db.queue('properties:select', { data: null, error: null });
    db.queue('properties:insert', { data: null, error: { message: 'check constraint' } });

    await expect(svc.provision(baseInput())).rejects.toThrow('Failed to create property: check constraint');
  });

  it('owner user insert failure throws', async () => {
    db.queue('tenants:select', { data: null, error: null });
    db.queue('plans:select', { data: null, error: null });
    db.queue('property_groups:insert', { data: { id: GROUP_ID }, error: null });
    db.queue('properties:select', { data: null, error: null });
    db.queue('properties:insert', { data: { id: PROPERTY_ID }, error: null });
    db.queue('users:insert', { data: null, error: { message: 'email taken' } });

    await expect(svc.provision(baseInput())).rejects.toThrow('Failed to create owner user: email taken');
  });

  it('access-grant failure is fatal (owner must not exist without a property)', async () => {
    db.queue('tenants:select', { data: null, error: null });
    db.queue('plans:select', { data: null, error: null });
    db.queue('property_groups:insert', { data: { id: GROUP_ID }, error: null });
    db.queue('properties:select', { data: null, error: null });
    db.queue('properties:insert', { data: { id: PROPERTY_ID }, error: null });
    db.queue('users:insert', { data: { id: OWNER_ID }, error: null });
    db.queue('user_property_access:insert', { data: null, error: { message: 'rls denied' } });

    await expect(svc.provision(baseInput())).rejects.toThrow(
      'Failed to create user_property_access for owner: rls denied',
    );
  });
});

describe('ProvisioningService.updateBillingStatus', () => {
  let svc: ProvisioningService;

  beforeEach(() => {
    vi.clearAllMocks();
    svc = new ProvisioningService();
    (db.calls as any).length = 0;
  });

  it('updates billing_status for the subscription and invalidates the tenant cache', async () => {
    db.queue('tenants:update', { data: { id: 't-1', subdomain: 'acme' }, error: null });

    await svc.updateBillingStatus('sub_123', 'suspended');

    const updateCall = db.calls.find((c) => c.table === 'tenants' && c.op === 'update')!;
    expect(updateCall.payload).toMatchObject({ billing_status: 'suspended' });
    expect(updateCall.payload).toHaveProperty('updated_at');
    // Filtered by subscription id, not tenant id
    const eqCall = db.calls.find((c) => c.table === 'tenants' && c.op === 'eq')!;
    expect(eqCall.args).toEqual(['stripe_subscription_id', 'sub_123']);
    expect(invalidateTenantCache).toHaveBeenCalledWith('t-1', 'acme');
  });

  it('re-resolves the plan when a tier change is included (upgrade/downgrade)', async () => {
    db.queue('tenants:update', { data: { id: 't-1', subdomain: 'acme' }, error: null });
    db.queue('plans:select', { data: { id: 'plan-growth', feature_limits: { x: 1 }, code: 'growth' }, error: null });

    await svc.updateBillingStatus('sub_123', 'active', 'growth');

    const updateCall = db.calls.find((c) => c.table === 'tenants' && c.op === 'update')!;
    expect(updateCall.payload).toMatchObject({
      billing_status: 'active',
      subscription_tier: 'growth',
      plan_id: 'plan-growth',
    });
  });

  it('does nothing harmful when no tenant matches (no cache invalidation, no throw)', async () => {
    db.queue('tenants:update', { data: null, error: null });

    await expect(svc.updateBillingStatus('sub_missing', 'active')).resolves.toBeUndefined();
    expect(invalidateTenantCache).not.toHaveBeenCalled();
  });

  it('update failure throws', async () => {
    db.queue('tenants:update', { data: null, error: { message: 'db down' } });

    await expect(svc.updateBillingStatus('sub_123', 'canceled')).rejects.toThrow('Failed to update billing status: db down');
  });
});
