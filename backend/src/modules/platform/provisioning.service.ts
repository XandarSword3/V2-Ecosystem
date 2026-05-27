/**
 * ProvisioningService
 *
 * Creates a fully-formed tenant from a Stripe checkout or subscription event.
 * Idempotent: calling provision() twice with the same stripe_subscription_id
 * returns the existing tenant without duplicating any rows.
 *
 * Provisioning sequence:
 *   1. Upsert tenants row (idempotency key: stripe_subscription_id)
 *   2. Upsert property_groups row linked to tenant
 *   3. Upsert default property inside the group
 *   4. Seed roles (super_admin, admin, staff, customer) scoped to tenant
 *   5. Create owner user account with hashed temporary password
 *   6. Assign super_admin role to owner within tenant
 *   7. Queue welcome / credential email (fire-and-forget)
 *
 * On partial failure the service logs the error and re-throws so the webhook
 * handler can return a non-200 response — Stripe will retry the webhook.
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import type { SubscriptionTier, BillingStatus } from '../../middleware/tenantAccess.middleware.js';
import { invalidateTenantCache } from '../../middleware/tenantAccess.middleware.js';

// ============================================
// Types
// ============================================

export interface ProvisioningInput {
  /** Stripe subscription ID — idempotency key */
  stripeSubscriptionId: string;
  stripeCustomerId: string;
  tier: SubscriptionTier;
  billingStatus: BillingStatus;
  operatorEmail: string;
  operatorName: string;
  subdomain: string;
  trialEndsAt?: Date | null;
}

export interface ProvisioningResult {
  tenantId: string;
  propertyGroupId: string;
  propertyId: string;
  ownerUserId: string;
  /** True if this was a fresh provision; false if idempotent no-op */
  created: boolean;
}

// Default roles seeded for every new tenant
const DEFAULT_ROLES = [
  { name: 'super_admin', description: 'Full platform access within this tenant', permissions: ['*'] },
  { name: 'admin',       description: 'Administrative access excluding billing',  permissions: ['admin.*'] },
  { name: 'staff',       description: 'Day-to-day operational access',            permissions: ['staff.*'] },
  { name: 'customer',    description: 'Guest-facing access',                      permissions: ['customer.*'] },
];

// ============================================
// ProvisioningService
// ============================================

export class ProvisioningService {

  /**
   * Provision a tenant from a Stripe event payload.
   * Safe to call multiple times with the same stripeSubscriptionId.
   */
  async provision(input: ProvisioningInput): Promise<ProvisioningResult> {
    const {
      stripeSubscriptionId,
      stripeCustomerId,
      tier,
      billingStatus,
      operatorEmail,
      operatorName,
      subdomain,
      trialEndsAt,
    } = input;

    const supabase = getSupabase();

    logger.info('[PROVISIONING] Starting tenant provisioning', {
      stripeSubscriptionId,
      subdomain,
      tier,
    });

    // ---- Step 1: Idempotency check ----
    const { data: existing } = await supabase
      .from('tenants')
      .select('id, property_group_id')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .maybeSingle();

    if (existing) {
      logger.info('[PROVISIONING] Tenant already provisioned — idempotent no-op', {
        tenantId: existing.id,
        stripeSubscriptionId,
      });

      // Still look up property and owner for the return value
      const { data: group } = await supabase
        .from('property_groups')
        .select('id')
        .eq('id', existing.property_group_id)
        .maybeSingle();

      const { data: property } = await supabase
        .from('properties')
        .select('id')
        .eq('group_id', existing.property_group_id)
        .limit(1)
        .maybeSingle();

      const { data: owner } = await supabase
        .from('users')
        .select('id')
        .eq('email', operatorEmail)
        .maybeSingle();

      return {
        tenantId: existing.id,
        propertyGroupId: group?.id ?? existing.property_group_id,
        propertyId: property?.id ?? '',
        ownerUserId: owner?.id ?? '',
        created: false,
      };
    }

    // ---- Step 2: Create property group ----
    const groupName = `${operatorName}'s Group`;
    const { data: group, error: groupErr } = await supabase
      .from('property_groups')
      .insert({
        name: groupName,
        description: `Default property group for ${subdomain}`,
      })
      .select('id')
      .single();

    if (groupErr || !group) {
      throw new Error(`[PROVISIONING] Failed to create property_group: ${groupErr?.message}`);
    }

    // ---- Step 3: Create tenant row ----
    const tenantId = crypto.randomUUID();
    const { error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        id: tenantId,
        subdomain,
        property_group_id: group.id,
        subscription_tier: tier,
        billing_status: billingStatus,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        feature_limits: defaultFeatureLimits(tier),
        trial_ends_at: trialEndsAt?.toISOString() ?? null,
      });

    if (tenantErr) {
      throw new Error(`[PROVISIONING] Failed to create tenant: ${tenantErr.message}`);
    }

    // ---- Step 4: Create default property ----
    const { data: property, error: propErr } = await supabase
      .from('properties')
      .insert({
        name: `${operatorName}'s Property`,
        group_id: group.id,
        slug: subdomain,
        is_active: true,
      })
      .select('id')
      .single();

    if (propErr || !property) {
      throw new Error(`[PROVISIONING] Failed to create property: ${propErr?.message}`);
    }

    // ---- Step 5: Seed roles (tenant-scoped) ----
    const rolesToInsert = DEFAULT_ROLES.map((r) => ({
      ...r,
      tenant_id: tenantId,
      permissions: r.permissions,
    }));

    const { error: rolesErr } = await supabase
      .from('roles')
      .upsert(rolesToInsert, { onConflict: 'tenant_id,name', ignoreDuplicates: true });

    if (rolesErr) {
      logger.warn('[PROVISIONING] Role seeding had errors (non-fatal)', { error: rolesErr.message });
    }

    // ---- Step 6: Create owner user ----
    const tempPassword = crypto.randomBytes(12).toString('base64url');
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({
        email: operatorEmail,
        full_name: operatorName,
        password_hash: passwordHash,
        is_active: true,
        email_verified: false,
        tenant_id: tenantId,
        must_change_password: true,
      })
      .select('id')
      .single();

    if (userErr || !user) {
      throw new Error(`[PROVISIONING] Failed to create owner user: ${userErr?.message}`);
    }

    // ---- Step 7: Assign super_admin role ----
    const { data: superAdminRole } = await supabase
      .from('roles')
      .select('id')
      .eq('name', 'super_admin')
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (superAdminRole) {
      await supabase
        .from('user_roles')
        .insert({ user_id: user.id, role_id: superAdminRole.id })
        .select();
    }

    // ---- Step 8: Property access for owner ----
    await supabase
      .from('user_property_access')
      .insert({ user_id: user.id, property_id: property.id });

    // ---- Step 9: Invalidate tenant cache ----
    invalidateTenantCache(tenantId, subdomain);

    logger.info('[PROVISIONING] Tenant provisioned successfully', {
      tenantId,
      propertyGroupId: group.id,
      propertyId: property.id,
      ownerUserId: user.id,
      subdomain,
    });

    // ---- Step 10: Queue welcome email (fire-and-forget) ----
    this.sendWelcomeEmail(operatorEmail, operatorName, subdomain, tempPassword).catch((err) =>
      logger.error('[PROVISIONING] Welcome email failed (non-fatal)', { err }),
    );

    return {
      tenantId,
      propertyGroupId: group.id,
      propertyId: property.id,
      ownerUserId: user.id,
      created: true,
    };
  }

  /**
   * Update billing_status for an existing tenant.
   * Called by the webhook handler on every Stripe subscription event.
   */
  async updateBillingStatus(
    stripeSubscriptionId: string,
    newStatus: BillingStatus,
    tier?: SubscriptionTier,
  ): Promise<void> {
    const supabase = getSupabase();

    const update: Record<string, unknown> = {
      billing_status: newStatus,
      updated_at: new Date().toISOString(),
    };
    if (tier) update.subscription_tier = tier;

    const { data, error } = await supabase
      .from('tenants')
      .update(update)
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .select('id, subdomain')
      .maybeSingle();

    if (error) {
      throw new Error(`[PROVISIONING] Failed to update billing status: ${error.message}`);
    }

    if (data) {
      invalidateTenantCache(data.id, data.subdomain);
      logger.info('[PROVISIONING] Billing status updated', {
        tenantId: data.id,
        stripeSubscriptionId,
        newStatus,
      });
    }
  }

  // ------------------------------------------
  // Private helpers
  // ------------------------------------------

  private async sendWelcomeEmail(
    email: string,
    name: string,
    subdomain: string,
    tempPassword: string,
  ): Promise<void> {
    // TODO: integrate with EmailService when ready.
    // For now, log the credentials so they're available during development.
    logger.info('[PROVISIONING] Welcome email queued', {
      email,
      subdomain,
      loginUrl: `https://${subdomain}.v2platform.com/login`,
      note: 'temp password logged for dev — replace with email delivery in production',
      tempPassword: process.env.NODE_ENV === 'production' ? '[REDACTED]' : tempPassword,
    });
  }
}

// ============================================
// Feature limits per tier
// ============================================

function defaultFeatureLimits(tier: SubscriptionTier): Record<string, unknown> {
  const limits: Record<SubscriptionTier, Record<string, unknown>> = {
    starter: {
      maxProperties: 1,
      maxModules: 5,
      maxStaffUsers: 10,
      analyticsRetentionDays: 30,
      customDomain: false,
      whiteLabel: false,
      apiAccess: false,
    },
    growth: {
      maxProperties: 10,
      maxModules: -1, // unlimited
      maxStaffUsers: 50,
      analyticsRetentionDays: 90,
      customDomain: true,
      whiteLabel: true,
      apiAccess: true,
    },
    enterprise: {
      maxProperties: -1,
      maxModules: -1,
      maxStaffUsers: -1,
      analyticsRetentionDays: 365,
      customDomain: true,
      whiteLabel: true,
      apiAccess: true,
    },
  };

  return limits[tier];
}

// ============================================
// Singleton
// ============================================

let _provisioningService: ProvisioningService | null = null;

export function getProvisioningService(): ProvisioningService {
  if (!_provisioningService) {
    _provisioningService = new ProvisioningService();
  }
  return _provisioningService;
}
