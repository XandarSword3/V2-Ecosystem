/**
 * SaaS Tenant Provisioning & Stripe Integration Test
 *
 * Real database integration test — no mocking of Supabase, connection.js, or DB.
 * Exercises ProvisioningService.provision() and updateBillingStatus() against
 * the live Postgres test database, and exercises HTTP endpoint signature validation.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import crypto from 'crypto';
import app from '../../src/app.js';
import { getSupabase } from '../../src/database/connection.js';
import { getProvisioningService } from '../../src/modules/platform/provisioning.service.js';

describe('SaaS Tenant Provisioning Integration (Real Database)', () => {
  const supabase = getSupabase();
  const provisioning = getProvisioningService();

  const testRunId = crypto.randomBytes(4).toString('hex');
  const testSubdomain = `test-tenant-${testRunId}`;
  const testEmail = `operator-${testRunId}@example.com`;
  const testOperatorName = `Test Operator ${testRunId}`;
  const stripeSubId = `sub_test_${testRunId}`;
  const stripeCustId = `cus_test_${testRunId}`;

  let createdTenantId: string | null = null;
  let createdGroupId: string | null = null;
  let createdPropertyId: string | null = null;
  let createdUserId: string | null = null;

  afterAll(async () => {
    // Clean up all seeded resources in reverse FK dependency order
    if (createdTenantId) {
      try {
        if (createdUserId) {
          await supabase.from('user_roles').delete().eq('user_id', createdUserId);
          await supabase.from('users').delete().eq('id', createdUserId);
        }
        await supabase.from('roles').delete().eq('tenant_id', createdTenantId);
        if (createdPropertyId) {
          await supabase.from('properties').delete().eq('id', createdPropertyId);
        }
        // Unlink property_group_id from tenant to avoid circular FK
        await supabase.from('tenants').update({ property_group_id: null }).eq('id', createdTenantId);
        if (createdGroupId) {
          await supabase.from('property_groups').delete().eq('id', createdGroupId);
        }
        await supabase.from('billing_history').delete().eq('tenant_id', createdTenantId);
        await supabase.from('tenants').delete().eq('id', createdTenantId);
      } catch (cleanupErr) {
        console.warn('[Provisioning Integration Cleanup] Non-fatal error:', cleanupErr);
      }
    }
  });

  it('1. provisions a full tenant hierarchy into the real database', async () => {
    const result = await provisioning.provision({
      stripeSubscriptionId: stripeSubId,
      stripeCustomerId: stripeCustId,
      tier: 'growth',
      billingStatus: 'active',
      operatorEmail: testEmail,
      operatorName: testOperatorName,
      subdomain: testSubdomain,
      trialEndsAt: null,
    });

    expect(result).toBeDefined();
    expect(result.created).toBe(true);
    expect(result.tenantId).toBeTruthy();
    expect(result.propertyGroupId).toBeTruthy();
    expect(result.propertyId).toBeTruthy();
    expect(result.ownerUserId).toBeTruthy();

    createdTenantId = result.tenantId;
    createdGroupId = result.propertyGroupId;
    createdPropertyId = result.propertyId;
    createdUserId = result.ownerUserId;

    // Direct database assertions: tenants row
    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .select('id, subdomain, subscription_tier, billing_status, stripe_subscription_id, property_group_id')
      .eq('id', createdTenantId)
      .single();

    expect(tErr).toBeNull();
    expect(tenant).toBeDefined();
    expect(tenant?.subdomain).toBe(testSubdomain);
    expect(tenant?.billing_status).toBe('active');
    expect(tenant?.stripe_subscription_id).toBe(stripeSubId);
    expect(tenant?.property_group_id).toBe(createdGroupId);

    // Direct database assertions: property_groups row
    const { data: group, error: gErr } = await supabase
      .from('property_groups')
      .select('id, name, tenant_id')
      .eq('id', createdGroupId)
      .single();

    expect(gErr).toBeNull();
    expect(group?.tenant_id).toBe(createdTenantId);

    // Direct database assertions: properties row
    const { data: prop, error: pErr } = await supabase
      .from('properties')
      .select('id, name, tenant_id, group_id, public_slug, is_active')
      .eq('id', createdPropertyId)
      .single();

    expect(pErr).toBeNull();
    expect(prop?.tenant_id).toBe(createdTenantId);
    expect(prop?.group_id).toBe(createdGroupId);
    expect(prop?.public_slug).toBeTruthy();
    expect(prop?.is_active).toBe(true);

    // Direct database assertions: roles seeded
    const { data: roles, error: rErr } = await supabase
      .from('roles')
      .select('id, name, tenant_id')
      .eq('tenant_id', createdTenantId);

    expect(rErr).toBeNull();
    expect(roles).toBeDefined();
    const roleNames = (roles || []).map((r) => r.name);
    expect(roleNames).toContain('tenant_owner');
    expect(roleNames).toContain('admin');
    expect(roleNames).toContain('staff');
    expect(roleNames).toContain('customer');

    // Direct database assertions: owner user row
    const { data: user, error: uErr } = await supabase
      .from('users')
      .select('id, email, full_name, tenant_id, scope, email_verified, must_change_password')
      .eq('id', createdUserId)
      .single();

    expect(uErr).toBeNull();
    expect(user?.email).toBe(testEmail);
    expect(user?.tenant_id).toBe(createdTenantId);
    expect(user?.scope).toBe('tenant_owner');
    expect(user?.email_verified).toBe(true);
    expect(user?.must_change_password).toBe(true);

    // Direct database assertions: user_roles assignment
    const ownerRole = roles?.find((r) => r.name === 'tenant_owner');
    expect(ownerRole).toBeDefined();

    const { data: userRole, error: urErr } = await supabase
      .from('user_roles')
      .select('id, user_id, role_id')
      .eq('user_id', createdUserId)
      .eq('role_id', ownerRole!.id)
      .maybeSingle();

    expect(urErr).toBeNull();
    expect(userRole).toBeDefined();
    expect(userRole?.user_id).toBe(createdUserId);
  });

  it('2. is strictly idempotent — second provision call does not duplicate rows', async () => {
    const result2 = await provisioning.provision({
      stripeSubscriptionId: stripeSubId,
      stripeCustomerId: stripeCustId,
      tier: 'growth',
      billingStatus: 'active',
      operatorEmail: testEmail,
      operatorName: testOperatorName,
      subdomain: testSubdomain,
      trialEndsAt: null,
    });

    expect(result2.created).toBe(false);
    expect(result2.tenantId).toBe(createdTenantId);
    expect(result2.ownerUserId).toBe(createdUserId);

    // Verify tenant count has not multiplied
    const { data: tenants } = await supabase
      .from('tenants')
      .select('id')
      .eq('stripe_subscription_id', stripeSubId);

    expect(tenants?.length).toBe(1);
  });

  it('3. updateBillingStatus updates real database tenant state', async () => {
    await provisioning.updateBillingStatus(stripeSubId, 'past_due');

    const { data: tenant } = await supabase
      .from('tenants')
      .select('billing_status')
      .eq('id', createdTenantId!)
      .single();

    expect(tenant?.billing_status).toBe('past_due');
  });

  it('4. rejects webhook HTTP request when stripe-signature header is missing', async () => {
    const res = await request(app)
      .post('/api/webhooks/stripe/saas')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'customer.subscription.updated' }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Missing stripe-signature header' });
  });

  it('5. rejects webhook HTTP request when stripe-signature is invalid', async () => {
    const res = await request(app)
      .post('/api/webhooks/stripe/saas')
      .set('stripe-signature', 't=123456789,v1=invalid_fake_signature_hash')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ type: 'customer.subscription.updated' }));

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'Webhook signature verification failed' });
  });
});
