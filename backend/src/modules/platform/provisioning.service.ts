/**
 * ProvisioningService
 *
 * Creates a fully-formed tenant from a Stripe checkout or subscription event.
 * Idempotent AND resumable: calling provision() again with the same
 * stripe_subscription_id converges a half-built tenant by creating any missing
 * child rows, then retries any undelivered welcome email.
 *
 * Provisioning sequence:
 *   1. Upsert tenants row (idempotency key: stripe_subscription_id)
 *   2. Upsert property_groups row linked to tenant
 *   3. Upsert default property inside the group
 *   4. Create owner user account with hashed temporary password and
 *      scope = 'tenant_owner' (scope is the single source of truth for
 *      authorization — no roles/user_roles rows are seeded per tenant)
 *   5. Grant property access for the owner (fatal — an owner with no property
 *      is a broken tenant)
 *   6. Persist the welcome email + encrypted temporary password to
 *      provisioning_email_outbox, then attempt delivery
 *
 * On partial failure the service logs the error and re-throws so the webhook
 * handler can return a non-200 response — Stripe will retry, and the retry
 * resumes at the first missing row rather than no-opping.
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
import { encrypt, decrypt } from '../../utils/encryption.js';

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

    // ---- Step 1: Resume an existing (possibly half-built) tenant ----
    // This is NOT a pure no-op. Provisioning spans several tables and has no
    // cross-table transaction, so a previous attempt may have created the
    // tenants row and then died. Stripe retries the webhook; every retry must
    // converge by creating whatever child rows are missing.
    const { data: existing } = await supabase
      .from('tenants')
      .select('id, property_group_id, subdomain')
      .eq('stripe_subscription_id', stripeSubscriptionId)
      .maybeSingle();

    if (existing) {
      logger.info('[PROVISIONING] Tenant already exists — verifying child rows', {
        tenantId: existing.id,
        stripeSubscriptionId,
      });

      const repaired = await this.ensureTenantChildren({
        tenantId: existing.id,
        subdomain: existing.subdomain || subdomain,
        operatorEmail,
        operatorName,
        propertyGroupId: existing.property_group_id,
      });

      // Only invalidate when a row was actually created/linked: a fully
      // provisioned tenant should not churn the cache on every Stripe retry.
      if (repaired.repaired) {
        await invalidateTenantCache(existing.id, existing.subdomain || subdomain);
      }
      await this.flushPendingWelcomeEmails(existing.id);

      return {
        tenantId: existing.id,
        propertyGroupId: repaired.propertyGroupId,
        propertyId: repaired.propertyId,
        ownerUserId: repaired.ownerUserId,
        created: false,
      };
    }

    // ---- Step 2: Create tenant row first (property_groups FK references tenants.id) ----
    const tenantId = crypto.randomUUID();
    const { plan_id: resolvedPlanId, feature_limits: resolvedFeatureLimits, code: resolvedTierCode } = await resolvePlanForTier(tier);

    const { error: tenantErr } = await supabase
      .from('tenants')
      .insert({
        id: tenantId,
        subdomain,
        subscription_tier: resolvedTierCode || tier,
        plan_id: resolvedPlanId,
        billing_status: billingStatus,
        stripe_customer_id: stripeCustomerId,
        stripe_subscription_id: stripeSubscriptionId,
        feature_limits: resolvedFeatureLimits,
        trial_ends_at: trialEndsAt?.toISOString() ?? null,
      });

    if (tenantErr) {
      // Two webhook deliveries can race. If another worker won the insert,
      // resume against its row instead of failing the event (which would make
      // Stripe retry forever against a tenant that already exists).
      if ((tenantErr as { code?: string }).code === '23505') {
        const { data: raced } = await supabase
          .from('tenants')
          .select('id, property_group_id, subdomain')
          .eq('stripe_subscription_id', stripeSubscriptionId)
          .maybeSingle();

        if (raced) {
          const repaired = await this.ensureTenantChildren({
            tenantId: raced.id,
            subdomain: raced.subdomain || subdomain,
            operatorEmail,
            operatorName,
            propertyGroupId: raced.property_group_id,
          });
          if (repaired.repaired) {
            await invalidateTenantCache(raced.id, raced.subdomain || subdomain);
          }
          await this.flushPendingWelcomeEmails(raced.id);
          return {
            tenantId: raced.id,
            propertyGroupId: repaired.propertyGroupId,
            propertyId: repaired.propertyId,
            ownerUserId: repaired.ownerUserId,
            created: false,
          };
        }
      }
      throw new Error(`[PROVISIONING] Failed to create tenant: ${tenantErr.message}`);
    }

    // ---- Steps 3-6: group, property, owner, property access ----
    // Shared with the resume path above so a retry after a partial failure
    // creates exactly the missing rows.
    const children = await this.ensureTenantChildren({
      tenantId,
      subdomain,
      operatorEmail,
      operatorName,
      propertyGroupId: null,
    });

    // ---- Step 7: Invalidate tenant cache (awaited: a stale negative cache
    // entry makes the new tenant unreachable until TTL expiry) ----
    await invalidateTenantCache(tenantId, subdomain);

    logger.info('[PROVISIONING] Tenant provisioned successfully', {
      tenantId,
      propertyGroupId: children.propertyGroupId,
      propertyId: children.propertyId,
      ownerUserId: children.ownerUserId,
      subdomain,
    });

    // ---- Step 8: Deliver the welcome email from the durable outbox ----
    // The credential is already persisted (encrypted). A delivery failure is
    // retried by the next webhook event for this subscription and never rolls
    // back the tenant.
    await this.flushPendingWelcomeEmails(tenantId);

    return {
      tenantId,
      propertyGroupId: children.propertyGroupId,
      propertyId: children.propertyId,
      ownerUserId: children.ownerUserId,
      created: true,
    };
  }

  /**
   * Create any child rows missing for a tenant.
   *
   * Provisioning spans tenants -> property_groups -> properties -> users ->
   * user_property_access with no cross-table transaction, so an interrupted
   * attempt leaves a partially built tenant. This method is the convergence
   * point: it creates only what is absent, is safe to call repeatedly, and is
   * a pure read on a fully provisioned tenant.
   *
   * Throws on every failure that would leave the tenant unusable, so the
   * webhook returns non-200 and Stripe retries. The previous code logged and
   * swallowed the user_property_access failure, producing an owner who could
   * sign in but had no property.
   */
  private async ensureTenantChildren(params: {
    tenantId: string;
    subdomain: string;
    operatorEmail: string;
    operatorName: string;
    propertyGroupId?: string | null;
  }): Promise<{ propertyGroupId: string; propertyId: string; ownerUserId: string; repaired: boolean }> {
    const { tenantId, subdomain, operatorEmail, operatorName } = params;
    const supabase = getSupabase();
    let repaired = false;

    // ---- Property group ----
    let groupId: string | null = params.propertyGroupId ?? null;

    if (groupId) {
      const { data: group } = await supabase
        .from('property_groups')
        .select('id')
        .eq('id', groupId)
        .eq('tenant_id', tenantId)
        .maybeSingle();
      if (!group) groupId = null;
    }

    if (!groupId) {
      const { data: existingGroup } = await supabase
        .from('property_groups')
        .select('id')
        .eq('tenant_id', tenantId)
        .order('created_at', { ascending: true })
        .limit(1)
        .maybeSingle();
      groupId = existingGroup?.id ?? null;
    }

    if (!groupId) {
      const { data: group, error: groupErr } = await supabase
        .from('property_groups')
        .insert({
          name: `${operatorName}'s Group`,
          description: `Default property group for ${subdomain}`,
          tenant_id: tenantId,
        })
        .select('id')
        .single();

      if (groupErr || !group) {
        throw new Error(`[PROVISIONING] Failed to create property_group: ${groupErr?.message}`);
      }
      groupId = group.id;
      repaired = true;
    }

    if (!groupId) {
      throw new Error('[PROVISIONING] Property group could not be resolved');
    }

    // Keep tenants.property_group_id authoritative even if an earlier attempt
    // created the group but died before linking it. Skip the write when the
    // tenant is already linked so a retry of a complete tenant stays a pure
    // read (no cache churn / no needless row versioning).
    if (params.propertyGroupId !== groupId) {
      const { error: linkErr } = await supabase
        .from('tenants')
        .update({ property_group_id: groupId })
        .eq('id', tenantId);

      if (linkErr) {
        throw new Error(`[PROVISIONING] Failed to link tenant to property_group: ${linkErr.message}`);
      }
      repaired = true;
    }

    // ---- Default property ----
    let { data: property } = await supabase
      .from('properties')
      .select('id')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle();

    if (!property) {
      const propertyName = `${operatorName}'s Property`;
      const publicSlug = await this.generateUniquePublicSlug(propertyName, groupId);

      const { data: createdProperty, error: propErr } = await supabase
        .from('properties')
        .insert({
          name: propertyName,
          group_id: groupId,
          tenant_id: tenantId,
          public_slug: publicSlug,
          is_active: true,
        })
        .select('id')
        .single();

      if (propErr || !createdProperty) {
        throw new Error(`[PROVISIONING] Failed to create property: ${propErr?.message}`);
      }
      property = createdProperty;
      repaired = true;
    }

    if (!property) {
      throw new Error('[PROVISIONING] Property could not be resolved');
    }

    // ---- Owner user ----
    // Scoped by tenant_id: email is only unique per-tenant (see
    // 20260704010000_scope_users_email_uniqueness_per_tenant.sql), so an
    // unscoped lookup could match another tenant's user row sharing the email.
    let { data: owner } = await supabase
      .from('users')
      .select('id')
      .eq('email', operatorEmail)
      .eq('tenant_id', tenantId)
      .maybeSingle();

    if (!owner) {
      // generateSecurePassword() guarantees one of each required character
      // class; a randomBytes(...).toString('base64url') password could fail the
      // platform's own requireSpecialChars policy.
      const tempPassword = generateSecurePassword(16);
      const passwordHash = await bcrypt.hash(tempPassword, 12);

      const { data: createdOwner, error: userErr } = await supabase
        .from('users')
        .insert({
          email: operatorEmail,
          full_name: operatorName,
          password_hash: passwordHash,
          is_active: true,
          email_verified: true, // Auto-verify email for new tenant provisioning
          tenant_id: tenantId,
          must_change_password: true,
          // scope defaults to 'customer' at the DB level — without this
          // explicit override, every newly provisioned tenant owner silently
          // became a 'customer' in the one column auth.service.ts treats as
          // the source of truth for authorization.
          scope: 'tenant_owner',
        })
        .select('id')
        .single();

      if (userErr || !createdOwner) {
        // A concurrent retry may have won the insert. Re-read before failing.
        const { data: racedOwner } = await supabase
          .from('users')
          .select('id')
          .eq('email', operatorEmail)
          .eq('tenant_id', tenantId)
          .maybeSingle();
        if (!racedOwner) {
          throw new Error(`[PROVISIONING] Failed to create owner user: ${userErr?.message}`);
        }
        owner = racedOwner;
      } else {
        owner = createdOwner;
        repaired = true;
        // Persist the credential BEFORE attempting delivery: the hash is
        // one-way, so this row is the only remaining copy of the temporary
        // password if SMTP is down.
        await this.enqueueWelcomeEmail({
          tenantId,
          userId: owner.id,
          email: operatorEmail,
          name: operatorName,
          subdomain,
          tempPassword,
        });
      }
    }

    // ---- Property access for owner ----
    const { data: existingAccess, error: accessReadErr } = await supabase
      .from('user_property_access')
      .select('id')
      .eq('user_id', owner.id)
      .eq('property_id', property.id)
      .maybeSingle();

    if (accessReadErr) {
      throw new Error(`[PROVISIONING] Failed to read user_property_access: ${accessReadErr.message}`);
    }

    if (!existingAccess) {
      const { error: accessErr } = await supabase
        .from('user_property_access')
        .insert({
          user_id: owner.id,
          property_id: property.id,
          tenant_id: tenantId,
          access_level: 'admin',
          is_primary: true,
        });

      // 23505 = a concurrent retry already granted it; anything else is fatal.
      if (accessErr && (accessErr as { code?: string }).code !== '23505') {
        throw new Error(`[PROVISIONING] Failed to create user_property_access for owner: ${accessErr.message}`);
      }
      repaired = true;
    }

    return {
      propertyGroupId: groupId,
      propertyId: property.id,
      ownerUserId: owner.id,
      repaired,
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
      const { plan_id, feature_limits } = await resolvePlanForTier(tier);
      update.plan_id = plan_id;
      // tenants.feature_limits is a snapshot read by FeatureLimitsService.
      // Re-resolving plan_id alone left an upgraded tenant enforcing the old
      // plan's caps forever.
      update.feature_limits = feature_limits;
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
      // A subscription event is a natural retry opportunity for a welcome
      // email whose SMTP delivery previously failed. Never throws.
      await this.flushPendingWelcomeEmails(data.id);
      logger.info('[PROVISIONING] Billing status updated', {
        tenantId: data.id,
        stripeSubscriptionId,
        newStatus,
      });
    }
  }

  /**
   * Update billing_status by tenant id. Used for tenants provisioned outside
   * Stripe (or before a subscription id existed) where matching on
   * stripe_subscription_id silently no-ops.
   */
  async updateBillingStatusByTenantId(
    tenantId: string,
    newStatus: BillingStatus,
  ): Promise<void> {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('tenants')
      .update({ billing_status: newStatus, updated_at: new Date().toISOString() })
      .eq('id', tenantId)
      .select('id, subdomain')
      .maybeSingle();

    if (error) {
      throw new Error(`[PROVISIONING] Failed to update billing status: ${error.message}`);
    }
    if (!data) {
      throw new Error(`[PROVISIONING] Tenant ${tenantId} not found while updating billing status`);
    }

    invalidateTenantCache(data.id, data.subdomain);
    logger.info('[PROVISIONING] Billing status updated by tenant id', {
      tenantId,
      newStatus,
    });
  }

  // ------------------------------------------
  // Private helpers
  // ------------------------------------------

  /**
   * Persist a credential email before delivery.
   *
   * Fatal on failure: at this point the temporary password exists only in
   * memory and its hash is one-way, so losing the row means the owner can
   * never receive the generated credential.
   */
  private async enqueueWelcomeEmail(params: {
    tenantId: string;
    userId: string;
    email: string;
    name: string;
    subdomain: string;
    tempPassword: string;
  }): Promise<void> {
    const supabase = getSupabase();
    const now = new Date().toISOString();

    const { error } = await supabase
      .from('provisioning_email_outbox')
      .upsert(
        {
          tenant_id: params.tenantId,
          user_id: params.userId,
          purpose: 'welcome',
          recipient_email: params.email,
          recipient_name: params.name,
          subdomain: params.subdomain,
          temp_password_encrypted: encrypt(params.tempPassword),
          status: 'pending',
          attempts: 0,
          last_error: null,
          sent_at: null,
          updated_at: now,
        },
        { onConflict: 'tenant_id,purpose' },
      );

    if (error) {
      throw new Error(`[PROVISIONING] Failed to persist welcome-email outbox row: ${error.message}`);
    }
  }

  /**
   * Deliver every pending/failed welcome email for a tenant.
   *
   * This is the retry loop: called after provisioning and on subscription
   * updates, so Stripe's webhook retries drive recovery from a temporarily
   * unavailable SMTP server without a cron job. It never throws — a mail
   * failure must not fail a webhook whose tenant writes already committed.
   *
   * Public so an operator/back-office action can force a retry.
   */
  async flushPendingWelcomeEmails(tenantId: string): Promise<void> {
    const supabase = getSupabase();

    const { data: pending, error } = await supabase
      .from('provisioning_email_outbox')
      .select('*')
      .eq('tenant_id', tenantId)
      .in('status', ['pending', 'failed'])
      .limit(5);

    if (error) {
      logger.error('[PROVISIONING] Failed to read pending welcome emails', {
        tenantId,
        error: error.message,
      });
      return;
    }

    const rows = Array.isArray(pending) ? pending : [];
    for (const row of rows) {
      let tempPassword: string;
      try {
        tempPassword = decrypt(row.temp_password_encrypted as string);
      } catch (err) {
        logger.error('[PROVISIONING] Cannot decrypt pending welcome email — abandoning row', {
          tenantId,
          outboxId: row.id,
          err,
        });
        await supabase
          .from('provisioning_email_outbox')
          .update({
            status: 'abandoned',
            last_error: 'decrypt failed (ENCRYPTION_KEY rotated?)',
            updated_at: new Date().toISOString(),
          })
          .eq('id', row.id);
        continue;
      }

      const sent = await this.sendWelcomeEmail({
        email: row.recipient_email as string,
        name: row.recipient_name as string,
        subdomain: row.subdomain as string,
        tempPassword,
        tenantId,
      });

      await supabase
        .from('provisioning_email_outbox')
        .update({
          status: sent ? 'sent' : 'failed',
          attempts: Number(row.attempts ?? 0) + 1,
          last_attempt_at: new Date().toISOString(),
          sent_at: sent ? new Date().toISOString() : null,
          last_error: sent ? null : 'emailService.sendEmail returned false',
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
    }
  }

  private async sendWelcomeEmail(params: {
    email: string;
    name: string;
    subdomain: string;
    tempPassword: string;
    tenantId: string;
  }): Promise<boolean> {
    const { email, name, subdomain, tempPassword, tenantId } = params;
    const loginUrl = buildTenantUrl(subdomain, '/login');

    const sent = await emailService.sendEmail({
      to: email,
      subject: 'Your V2 Ecosystem account is ready',
      tenantId,
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
      return true;
    }

    // Never log the password: the outbox row holds it encrypted and the next
    // provision/subscription event retries delivery.
    logger.error('[PROVISIONING] Welcome email delivery failed — kept in outbox for retry', {
      email,
      subdomain,
      tenantId,
    });
    return false;
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
