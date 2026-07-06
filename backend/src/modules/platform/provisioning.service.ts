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
 *   4. Seed roles (tenant_owner, admin, staff, customer) scoped to tenant
 *   5. Create owner user account with hashed temporary password
 *   6. Assign tenant_owner + admin roles to owner within tenant
 *
 * NOTE: the owner role is named 'tenant_owner', NOT 'super_admin'. The string
 * 'super_admin' is treated as an unconditional, tenant-blind bypass by
 * authorize() (auth.middleware.ts) and by requirePermission/canAccess
 * (permission.middleware.ts) — it is reserved for the actual platform
 * operator (is_platform_root tenant / isPlatformAdmin flag). Never assign a
 * role literally named 'super_admin' here; doing so previously handed every
 * paying customer the same unconditional bypass as the platform operator.
 *   7. Queue welcome / credential email (fire-and-forget)
 *
 * On partial failure the service logs the error and re-throws so the webhook
 * handler can return a non-200 response — Stripe will retry the webhook.
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { getSupabase } from '../../database/connection.js';
import { logger } from '../../utils/logger.js';
import { emailService } from '../../services/email.service.js';
import { generateSecurePassword } from '../../services/password-policy.service.js';
import type { SubscriptionTier, BillingStatus } from '../../middleware/tenantAccess.middleware.js';
import { invalidateTenantCache } from '../../middleware/tenantAccess.middleware.js';
import { buildTenantUrl } from '../../utils/tenant-url.js';

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

// Default roles seeded for every new tenant.
//
// IMPORTANT: the tenant owner's role is named 'tenant_owner', never
// 'super_admin'. authorize() (auth.middleware.ts) and the permission.middleware.ts
// helpers treat the literal string 'super_admin' as an unconditional, tenant-
// blind bypass reserved for the platform operator. Seeding that name here
// would hand every paying customer the same unconditional bypass as the
// platform operator — which is exactly what happened before this fix.
const DEFAULT_ROLES = [
  { name: 'tenant_owner', description: 'Full administrative access within this tenant (tenant owner only)', permissions: ['*'] },
  { name: 'admin',       description: 'Administrative access excluding billing',  permissions: ['admin.*'] },
  { name: 'staff',       description: 'Day-to-day operational access',            permissions: ['staff.*'] },
  { name: 'customer',    description: 'Guest-facing access',                      permissions: ['customer.*'] },
];

// ============================================
// Slug generation for properties.public_slug
//
// public_slug is the customer-facing routing identifier used to resolve a
// property from its subdomain ({public_slug}.{tenant_subdomain}.v2platform.com).
// It is DISTINCT from property_code, which is reserved for external OTA
// channel mappings (Booking.com / Expedia / Airbnb hotel_id pairings) — see
// the public_slug column comment in the migration for the full reasoning.
// Must satisfy the DB-level DNS label CHECK constraint:
//   ^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$
// ============================================

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .substring(0, 50);
  return slug || 'property';
}

// ============================================
// ProvisioningService
// ============================================

export class ProvisioningService {

  /**
   * Generate a public_slug for a new property that doesn't collide with any
   * existing property in the same group. Mirrors the collision-suffix logic
   * in the 20260620010000_add_property_public_slug.sql backfill so newly
   * provisioned properties follow the same convention as backfilled ones.
   */
  private async generateUniquePublicSlug(name: string, groupId: string): Promise<string> {
    const supabase = getSupabase();
    const base = slugify(name);

    let candidate = base;
    let suffix = 1;

    // Bounded loop — defends against an unexpected runaway collision chain
    // rather than looping forever on a pathological input.
    for (let attempt = 0; attempt < 50; attempt++) {
      const { data: existing } = await supabase
        .from('properties')
        .select('id')
        .eq('group_id', groupId)
        .eq('public_slug', candidate)
        .maybeSingle();

      if (!existing) return candidate;

      suffix += 1;
      candidate = `${base}-${suffix}`;
    }

    // Extremely unlikely fallback — append a short random suffix instead of
    // looping indefinitely.
    return `${base}-${crypto.randomBytes(3).toString('hex')}`;
  }

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

      // Scoped by tenant_id: email is now only unique per-tenant (see
      // 20260704010000_scope_users_email_uniqueness_per_tenant.sql), so an
      // unscoped lookup here could match a different tenant's user row
      // sharing the same email and return the wrong owner id.
      const { data: owner } = await supabase
        .from('users')
        .select('id')
        .eq('email', operatorEmail)
        .eq('tenant_id', existing.id)
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
    // Resolve plan_id + feature_limits from the LIVE plans table (the
    // admin-editable source of truth) rather than a hardcoded duplicate.
    // Non-fatal if the lookup fails or no row matches: falls back to the
    // hardcoded FALLBACK_FEATURE_LIMITS so provisioning never breaks if the
    // plans table is empty, mid-migration, or a tier has no matching plan
    // row yet. plan_id stays null in that case — tenantAccess.middleware.ts
    // already falls back to the tenants.feature_limits snapshot when plan_id
    // is null, so this degrades safely either way.
    const { plan_id: resolvedPlanId, feature_limits: resolvedFeatureLimits, code: resolvedTierCode } = await resolvePlanForTier(tier);

    const tenantId = crypto.randomUUID();
    const { error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        id: tenantId,
        subdomain,
        property_group_id: group.id,
        subscription_tier: resolvedTierCode || tier, // Use the resolved tier code from database
        plan_id: resolvedPlanId,
        billing_status: billingStatus,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        feature_limits: resolvedFeatureLimits,
        trial_ends_at: trialEndsAt?.toISOString() ?? null,
      });

    if (tenantErr) {
      throw new Error(`[PROVISIONING] Failed to create tenant: ${tenantErr.message}`);
    }

    // ---- Step 4: Create default property ----
    const propertyName = `${operatorName}'s Property`;
    const publicSlug = await this.generateUniquePublicSlug(propertyName, group.id);

    const { data: property, error: propErr } = await supabase
      .from('properties')
      .insert({
        name: propertyName,
        group_id: group.id,
        tenant_id: tenantId,
        public_slug: publicSlug,
        is_active: true,
      })
      .select('id')
      .single();

    if (propErr || !property) {
      throw new Error(`[PROVISIONING] Failed to create property: ${propErr?.message}`);
    }

    // ---- Step 5: Seed roles (tenant-scoped) ----
    // Insert roles one by one to handle unique constraint conflicts gracefully
    for (const role of DEFAULT_ROLES) {
      const { error: roleErr } = await supabase
        .from('roles')
        .insert({
          ...role,
          tenant_id: tenantId,
          permissions: role.permissions,
        });

      if (roleErr) {
        logger.warn('[PROVISIONING] Role seeding had error (non-fatal)', { role: role.name, error: roleErr.message });
      }
    }

    // ---- Step 6: Create owner user ----
    // FIX: crypto.randomBytes(...).toString('base64url') only ever produces
    // [A-Za-z0-9-_] — it can never contain a special character, so a temp
    // password generated that way can fail this very platform's own
    // requireSpecialChars policy (password-policy.service.ts) despite being
    // the credential we email to a brand-new paying customer. generateSecurePassword()
    // already guarantees one of each required character class.
    const tempPassword = generateSecurePassword(16);
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const { data: user, error: userErr } = await supabase
      .from('users')
      .insert({
        email: operatorEmail,
        full_name: operatorName,
        password_hash: passwordHash,
        is_active: true,
        email_verified: true, // Auto-verify email for new tenant provisioning
        tenant_id: tenantId,
        must_change_password: true,
        // scope defaults to 'customer' at the DB level — without this explicit
        // override, every newly provisioned tenant owner silently became a
        // 'customer' in the one column the rest of the app (auth.service.ts)
        // treats as the actual source of truth for authorization.
        scope: 'tenant_owner',
      })
      .select('id')
      .single();

    if (userErr || !user) {
      throw new Error(`[PROVISIONING] Failed to create owner user: ${userErr?.message}`);
    }

    // ---- Step 7: Assign tenant_owner + admin roles ----
    // tenant_owner: the elevated, owner-only actions within this tenant
    // (roles/permissions management, user deletion, etc. — see admin.routes.ts).
    // admin: the standard tenant-admin role, so the owner also has full access
    // to every route already gated by authorize('admin', ...) / authorizeManager,
    // same as any staff member promoted to admin within this tenant.
    const { data: ownerRoles } = await supabase
      .from('roles')
      .select('id, name')
      .eq('tenant_id', tenantId)
      .in('name', ['tenant_owner', 'admin']);

    if (ownerRoles && ownerRoles.length > 0) {
      const roleAssignments = ownerRoles.map((r) => ({ user_id: user.id, role_id: r.id, tenant_id: tenantId }));
      const { error: roleAssignErr } = await supabase
        .from('user_roles')
        .insert(roleAssignments)
        .select();

      if (roleAssignErr) {
        logger.warn('[PROVISIONING] Owner role assignment had errors (non-fatal)', { error: roleAssignErr.message });
      }
    } else {
      logger.error('[PROVISIONING] tenant_owner/admin roles not found after seeding — owner will have no admin access', { tenantId });
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
   *
   * If `tier` is provided (subscription upgrade/downgrade), plan_id is
   * re-resolved against the live plans table so the tenant's enforced
   * feature_limits switch to the new plan immediately, same as a fresh
   * signup.
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
    if (tier) {
      update.subscription_tier = tier;
      const { plan_id } = await resolvePlanForTier(tier);
      update.plan_id = plan_id;
    }

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
    const loginUrl = buildTenantUrl(subdomain, '/login');

    const sent = await emailService.sendEmail({
      to: email,
      subject: 'Your V2 Ecosystem account is ready',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1>Welcome, ${name}!</h1>
          <p>Your V2 Ecosystem account has been created.</p>
          <p><strong>Login URL:</strong> <a href="${loginUrl}">${loginUrl}</a></p>
          <p><strong>Email:</strong> ${email}</p>
          <p><strong>Temporary password:</strong> ${tempPassword}</p>
          <p>You'll be asked to set a new password the first time you sign in.</p>
        </div>
      `,
    });

    if (sent) {
      logger.info('[PROVISIONING] Welcome email sent', { email, subdomain });
      return;
    }

    // Send failed (SMTP not configured, etc.) — log as a fallback so the
    // credentials aren't lost outright. Same dev-only redaction as before;
    // in production this means a failed send currently has no recovery path
    // other than the password-reset flow — flagged in CONTEXT.md as a
    // follow-up (e.g. an admin "resend welcome email" action).
    logger.warn('[PROVISIONING] Welcome email failed to send — credentials logged for manual delivery', {
      email,
      subdomain,
      loginUrl,
      tempPassword: process.env.NODE_ENV === 'production' ? '[REDACTED]' : tempPassword,
    });
  }
}

// ============================================
// Plan resolution (DB-backed, with non-fatal fallback)
// ============================================

/**
 * Resolve a tier string to its live plan row in the `plans` table.
 *
 * This is the fix for the bug where editing a plan's feature_limits in the
 * admin Plans CRUD had zero effect on anyone — provisioning previously read
 * from FALLBACK_FEATURE_LIMITS below (a hardcoded duplicate) instead of the
 * database. Now: DB is checked first, every time, for both new signups and
 * tier changes. The hardcoded object below is ONLY used if the plans table
 * lookup fails or returns no matching row — kept so provisioning never hard-
 * fails just because a plan row is missing or the table isn't seeded yet,
 * matching the same non-fatal-fallback pattern already used for Stripe sync
 * elsewhere in this codebase (see plans.controller.ts).
 *
 * Returns plan_id: null when falling back — tenantAccess.middleware.ts
 * already treats a null plan_id as "use the tenants.feature_limits snapshot
 * instead", so this degrades safely.
 */
async function resolvePlanForTier(
  tier: SubscriptionTier,
): Promise<{ plan_id: string | null; feature_limits: Record<string, unknown>; code: string | null }> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('plans')
      .select('id, feature_limits, code')
      .eq('code', tier)
      .eq('is_active', true)
      .maybeSingle();

    if (error) {
      logger.warn('[PROVISIONING] plans table lookup failed, falling back to hardcoded feature_limits', { tier, error: error.message });
      return { plan_id: null, feature_limits: FALLBACK_FEATURE_LIMITS[tier], code: tier };
    }

    if (!data) {
      logger.warn('[PROVISIONING] No active plan row found for tier, falling back to hardcoded feature_limits', { tier });
      return { plan_id: null, feature_limits: FALLBACK_FEATURE_LIMITS[tier], code: tier };
    }

    return { 
      plan_id: data.id, 
      feature_limits: (data.feature_limits as Record<string, unknown>) ?? FALLBACK_FEATURE_LIMITS[tier],
      code: data.code 
    };
  } catch (err) {
    logger.error('[PROVISIONING] Unexpected error resolving plan for tier, falling back to hardcoded feature_limits', { tier, err });
    return { plan_id: null, feature_limits: FALLBACK_FEATURE_LIMITS[tier], code: tier };
  }
}

/**
 * Last-resort fallback only — NOT the source of truth. The plans table
 * (edited via the admin Plans CRUD) is the source of truth; see
 * resolvePlanForTier() above. This only fires if that lookup fails.
 */
const FALLBACK_FEATURE_LIMITS: Record<SubscriptionTier, Record<string, unknown>> = {
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
