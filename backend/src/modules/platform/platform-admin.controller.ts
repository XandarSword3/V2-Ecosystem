/**
 * Platform Admin Controller
 *
 * Exposes the control plane API for platform administrators (is_platform_admin = true).
 * All routes require the requirePlatformAdmin middleware.
 *
 * Endpoints:
 *   GET  /api/platform/tenants                  — list all tenants with billing overview
 *   GET  /api/platform/tenants/:id              — single tenant detail
 *   POST /api/platform/tenants/:id/suspend      — suspend a tenant
 *   POST /api/platform/tenants/:id/reactivate   — reactivate a suspended tenant
 *   POST /api/platform/tenants/:id/cancel       — hard-cancel a tenant
 *   PATCH /api/platform/tenants/:id/tier        — change subscription tier
 *   GET  /api/platform/revenue                  — MRR overview (aggregated from tenants)
 *
 * Public (no auth):
 *   GET  /api/tenants/by-slug/:slug             — validate tenant exists by slug
 */

import { Request, Response } from 'express';
import { getSupabase } from '../../database/connection.js';
import { getSaasBillingService } from '../../services/saas-billing.service.js';
import { getProvisioningService } from './provisioning.service.js';
import { invalidateTenantCache } from '../../middleware/tenantAccess.middleware.js';
import { logger } from '../../utils/logger.js';
import type { SubscriptionTier } from '../../middleware/tenantAccess.middleware.js';

// ============================================
// List all tenants
// ============================================

export async function listTenants(req: Request, res: Response): Promise<void> {
  try {
    const supabase = getSupabase();
    const page = parseInt(req.query.page as string || '1', 10);
    const limit = Math.min(parseInt(req.query.limit as string || '50', 10), 100);
    const offset = (page - 1) * limit;
    const status = req.query.status as string | undefined;

    let query = supabase
      .from('tenants')
      .select('id, subdomain, subscription_tier, billing_status, trial_ends_at, created_at, stripe_customer_id, property_group_id', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (status) {
      query = query.eq('billing_status', status);
    }

    const { data, error, count } = await query;

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    const tenantIds = (data ?? []).map((t) => t.id);

    // Owner email — the frontend tenant list has no email column source at
    // all right now. There's no explicit "owner" flag on users, but
    // provisioning.service.ts creates exactly one user per tenant at signup
    // (the operator), so the earliest-created user for a tenant_id is that
    // tenant's owner. Ordered ascending so the first row seen per tenant_id
    // below is that earliest user.
    const emailByTenantId = new Map<string, string>();
    if (tenantIds.length > 0) {
      const { data: ownerUsers, error: ownerErr } = await supabase
        .from('users')
        .select('email, tenant_id, created_at')
        .in('tenant_id', tenantIds)
        .order('created_at', { ascending: true });

      if (ownerErr) {
        logger.warn('[PLATFORM] listTenants owner-email lookup failed (non-fatal)', { error: ownerErr.message });
      } else {
        for (const u of ownerUsers ?? []) {
          if (u.tenant_id && !emailByTenantId.has(u.tenant_id)) {
            emailByTenantId.set(u.tenant_id, u.email);
          }
        }
      }
    }

    // property_count / module_count — batched across the whole page instead
    // of one query per tenant. Mirrors the per-tenant logic in getTenant()
    // below, just grouped by property_group_id up front.
    const groupIds = Array.from(
      new Set((data ?? []).map((t) => t.property_group_id).filter((g): g is string => !!g)),
    );

    const propertyCountByGroup = new Map<string, number>();
    const moduleCountByGroup = new Map<string, number>();

    if (groupIds.length > 0) {
      const { data: propertyRows } = await supabase
        .from('properties')
        .select('id, group_id')
        .in('group_id', groupIds);

      const propertyIdsByGroup = new Map<string, string[]>();
      for (const p of propertyRows ?? []) {
        propertyCountByGroup.set(p.group_id, (propertyCountByGroup.get(p.group_id) ?? 0) + 1);
        if (!propertyIdsByGroup.has(p.group_id)) propertyIdsByGroup.set(p.group_id, []);
        propertyIdsByGroup.get(p.group_id)!.push(p.id);
      }

      const allPropertyIds = (propertyRows ?? []).map((p) => p.id);
      if (allPropertyIds.length > 0) {
        const { data: moduleRows } = await supabase
          .from('modules')
          .select('property_id')
          .in('property_id', allPropertyIds);

        const moduleCountByProperty = new Map<string, number>();
        for (const m of moduleRows ?? []) {
          if (!m.property_id) continue;
          moduleCountByProperty.set(m.property_id, (moduleCountByProperty.get(m.property_id) ?? 0) + 1);
        }

        for (const [groupId, propIds] of propertyIdsByGroup) {
          const total = propIds.reduce((sum, pid) => sum + (moduleCountByProperty.get(pid) ?? 0), 0);
          moduleCountByGroup.set(groupId, total);
        }
      }
    }

    // MRR — same tier→price resolution used by getRevenueOverview/getPlatformStats,
    // so this list's numbers always agree with the aggregate dashboard ones.
    const tierMrr = await resolveTierMrrMap();

    // Last activity — best-effort from audit_logs.tenant_id. Capped at the
    // 500 most recent audit rows across the matched tenants rather than a
    // full GROUP BY (not supported by supabase-js), so a tenant with no
    // activity in that recent window will show no last_activity even if it
    // has older rows further back — acceptable for a "how recently active"
    // signal, not treated as a complete history.
    const lastActivityByTenant = new Map<string, string>();
    if (tenantIds.length > 0) {
      const { data: activityRows, error: activityErr } = await supabase
        .from('audit_logs')
        .select('tenant_id, created_at')
        .in('tenant_id', tenantIds)
        .order('created_at', { ascending: false })
        .limit(500);

      if (activityErr) {
        logger.warn('[PLATFORM] listTenants last_activity lookup failed (non-fatal)', { error: activityErr.message });
      } else {
        for (const r of activityRows ?? []) {
          if (r.tenant_id && !lastActivityByTenant.has(r.tenant_id)) {
            lastActivityByTenant.set(r.tenant_id, r.created_at);
          }
        }
      }
    }

    const enriched = (data ?? []).map((t) => {
      const propertyCount = t.property_group_id ? propertyCountByGroup.get(t.property_group_id) ?? 0 : 0;
      const moduleCount = t.property_group_id ? moduleCountByGroup.get(t.property_group_id) ?? 0 : 0;
      const mrr =
        t.billing_status === 'active' || t.billing_status === 'past_due'
          ? tierMrr[t.subscription_tier as SubscriptionTier] ?? 0
          : 0;

      return {
        ...t,
        email: emailByTenantId.get(t.id) ?? null,
        property_count: propertyCount,
        module_count: moduleCount,
        mrr,
        last_activity: lastActivityByTenant.get(t.id) ?? null,
      };
    });

    res.json({
      success: true,
      data: enriched,
      pagination: { page, limit, total: count ?? 0 },
    });
  } catch (err) {
    logger.error('[PLATFORM] listTenants error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// ============================================
// Get single tenant
// ============================================

export async function getTenant(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const supabase = getSupabase();

    const { data: tenant, error } = await supabase
      .from('tenants')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }
    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    // Fetch the actual property rows — the frontend tenant detail page
    // renders tenant.properties directly (name, slug, module_count,
    // is_active), not just a count.
    const { data: propertyRows } = await supabase
      .from('properties')
      .select('id, name, public_slug, is_active')
      .eq('group_id', tenant.property_group_id);

    const propertyIds = (propertyRows ?? []).map((p) => p.id);

    // Fetch module rows for those properties and count per property_id
    // client-side (no GROUP BY over supabase-js).
    const { data: moduleRows } = propertyIds.length
      ? await supabase.from('modules').select('id, property_id').in('property_id', propertyIds)
      : { data: [] as { id: string; property_id: string }[] };

    const moduleCountByProperty = new Map<string, number>();
    for (const m of moduleRows ?? []) {
      if (!m.property_id) continue;
      moduleCountByProperty.set(m.property_id, (moduleCountByProperty.get(m.property_id) ?? 0) + 1);
    }

    const properties = (propertyRows ?? []).map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.public_slug,
      module_count: moduleCountByProperty.get(p.id) ?? 0,
      is_active: p.is_active,
    }));

    // MRR for this single tenant — same tier→price resolution used by the
    // platform-wide revenue endpoints, so a single tenant's number always
    // agrees with the aggregate ones.
    const tierMrr = await resolveTierMrrMap();
    const mrr =
      tenant.billing_status === 'active' || tenant.billing_status === 'past_due'
        ? tierMrr[tenant.subscription_tier as SubscriptionTier] ?? 0
        : 0;

    // Billing history — written by saas-webhook.controller.ts on
    // invoice.paid / invoice.payment_failed / customer.subscription.deleted.
    const { data: billingHistory } = await supabase
      .from('billing_history')
      .select('id, event_type, amount, currency, status, created_at')
      .eq('tenant_id', id)
      .order('created_at', { ascending: false })
      .limit(20);

    res.json({
      success: true,
      data: {
        ...tenant,
        properties,
        propertyCount: properties.length,
        moduleCount: properties.reduce((sum, p) => sum + p.module_count, 0),
        mrr,
        billing_history: billingHistory ?? [],
      },
    });
  } catch (err) {
    logger.error('[PLATFORM] getTenant error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// ============================================
// Suspend tenant
// ============================================

export async function suspendTenant(req: Request, res: Response): Promise<void> {
  await updateTenantBillingStatus(req, res, 'suspended');
}

// ============================================
// Reactivate tenant
// ============================================

export async function reactivateTenant(req: Request, res: Response): Promise<void> {
  await updateTenantBillingStatus(req, res, 'active');
}

// ============================================
// Cancel tenant
// ============================================

export async function cancelTenant(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const supabase = getSupabase();

    const { data: tenant } = await supabase
      .from('tenants')
      .select('stripe_subscription_id, subdomain')
      .eq('id', id)
      .maybeSingle();

    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    // Cancel in Stripe (immediate)
    if (tenant.stripe_subscription_id) {
      try {
        const billing = getSaasBillingService();
        await billing.cancelSubscription(tenant.stripe_subscription_id, { atPeriodEnd: false });
      } catch (stripeErr) {
        logger.warn('[PLATFORM] Stripe cancellation failed — still updating local status', { stripeErr });
      }
    }

    await getProvisioningService().updateBillingStatus(
      tenant.stripe_subscription_id ?? id,
      'cancelled',
    );

    res.json({ success: true, message: 'Tenant cancelled' });
  } catch (err) {
    logger.error('[PLATFORM] cancelTenant error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// ============================================
// Change tier
// ============================================

export async function changeTier(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const { tier } = req.body as { tier: SubscriptionTier };

    if (!tier || typeof tier !== 'string' || tier.trim() === '') {
      res.status(400).json({ success: false, error: 'Tier is required' });
      return;
    }

    const supabase = getSupabase();

    // Dynamically validate tier against active plans in the database
    const { data: targetPlan } = await supabase
      .from('plans')
      .select('id, code, is_active')
      .eq('code', tier)
      .eq('is_active', true)
      .maybeSingle();

    if (!targetPlan) {
      res.status(400).json({ success: false, error: `Invalid tier: '${tier}'. Plan does not exist or is not active.` });
      return;
    }

    const { data: tenant } = await supabase
      .from('tenants')
      .select('stripe_subscription_id, subscription_tier, subdomain')
      .eq('id', id)
      .maybeSingle();

    if (!tenant?.stripe_subscription_id) {
      res.status(404).json({ success: false, error: 'Tenant not found or has no Stripe subscription' });
      return;
    }

    const billing = getSaasBillingService();
    const result = await billing.changeTier(
      tenant.stripe_subscription_id,
      tenant.subscription_tier as SubscriptionTier,
      tier,
    );

    // Sync tier locally — also re-resolve plan_id so feature_limits switch
    // to the new plan immediately (same fix as the webhook path in
    // provisioning.service.ts's updateBillingStatus; this is the manual
    // admin-initiated equivalent of that same tier-change event).
    await supabase
      .from('tenants')
      .update({ subscription_tier: tier, plan_id: targetPlan.id, updated_at: new Date().toISOString() })
      .eq('id', id);

    invalidateTenantCache(id, tenant.subdomain);

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[PLATFORM] changeTier error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// ============================================
// Revenue overview (MRR)
// ============================================

export async function getRevenueOverview(_req: Request, res: Response): Promise<void> {
  try {
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('tenants')
      .select('subscription_tier, billing_status');

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    // Prices come from the live plans table — the admin-editable source of
    // truth — not env vars. Env vars only cover as a last-resort fallback
    // for any tier with no matching plan row, so MRR never silently reads
    // as $0 just because a plan is missing.
    const tierMrr = await resolveTierMrrMap();

    const counts: Record<string, number> = { starter: 0, growth: 0, enterprise: 0, total: 0 };
    let mrrCents = 0;

    for (const t of (data ?? [])) {
      if (t.billing_status === 'active' || t.billing_status === 'past_due') {
        const tier = t.subscription_tier as SubscriptionTier;
        counts[tier] = (counts[tier] ?? 0) + 1;
        counts.total += 1;
        mrrCents += tierMrr[tier] ?? 0;
      }
    }

    res.json({
      success: true,
      data: {
        mrrCents,
        mrrFormatted: `$${(mrrCents / 100).toFixed(2)}`,
        annualizedCents: mrrCents * 12,
        tenantCounts: counts,
      },
    });
  } catch (err) {
    logger.error('[PLATFORM] getRevenueOverview error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// ============================================
// Platform stats (control plane dashboard KPIs)
// ============================================

export async function getPlatformStats(_req: Request, res: Response): Promise<void> {
  try {
    const supabase = getSupabase();

    // All tenants in one query
    const { data, error } = await supabase
      .from('tenants')
      .select('subscription_tier, billing_status, created_at');

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    const rows = data ?? [];

    // Prices come from the live plans table, same fix as getRevenueOverview above.
    const tierMrr = await resolveTierMrrMap();

    let totalMrr = 0;
    let activeTenants = 0;
    let trialingTenants = 0;
    let suspendedTenants = 0;

    for (const t of rows) {
      if (t.billing_status === 'active' || t.billing_status === 'past_due') {
        totalMrr += tierMrr[t.subscription_tier as SubscriptionTier] ?? 0;
        activeTenants++;
      }
      if (t.billing_status === 'trialing') trialingTenants++;
      if (t.billing_status === 'suspended') suspendedTenants++;
    }

    // MRR history — bucket by month for the last 6 months
    const now = new Date();
    const revenueHistory: { date: string; mrr: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const monthDate = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const monthKey = monthDate.toISOString().slice(0, 7); // "2026-05"
      const monthMrr = rows
        .filter(t => {
          const created = new Date(t.created_at);
          return (
            created <= new Date(now.getFullYear(), now.getMonth() - i + 1, 0) &&
            (t.billing_status === 'active' || t.billing_status === 'past_due')
          );
        })
        .reduce((sum, t) => sum + (tierMrr[t.subscription_tier as SubscriptionTier] ?? 0), 0);
      revenueHistory.push({ date: monthKey, mrr: monthMrr });
    }

    // Simple MoM growth: last vs second-to-last month
    const lastMrr = revenueHistory.at(-1)?.mrr ?? 0;
    const prevMrr = revenueHistory.at(-2)?.mrr ?? 0;
    const mrrGrowthPercent = prevMrr === 0
      ? 0
      : parseFloat((((lastMrr - prevMrr) / prevMrr) * 100).toFixed(1));

    res.json({
      success: true,
      data: {
        total_tenants: rows.length,
        active_tenants: activeTenants,
        trialing_tenants: trialingTenants,
        suspended_tenants: suspendedTenants,
        total_mrr: totalMrr,
        mrr_growth_percent: mrrGrowthPercent,
        revenue_history: revenueHistory,
      },
    });
  } catch (err) {
    logger.error('[PLATFORM] getPlatformStats error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// ============================================
// Checkout session (landing page → Stripe)
// ============================================

export async function createCheckoutSession(req: Request, res: Response): Promise<void> {
  try {
    const { tier, email, name, subdomain } = req.body as {
      tier: SubscriptionTier;
      email: string;
      name: string;
      subdomain: string;
    };

    if (!tier || !email || !name || !subdomain) {
      res.status(400).json({ success: false, error: 'tier, email, name, and subdomain are required' });
      return;
    }

    const supabase = getSupabase();

    // Check if email already belongs to an existing tenant owner.
    // NOTE: intentionally scoped to scope = 'tenant_owner' — the `users` table
    // holds every role across every tenant (customers, staff, etc.), so an
    // unscoped email match here would block anyone who's ever been a customer
    // (e.g. on the platform demo tenant) from ever becoming a real tenant owner.
    const { data: existingOwner } = await supabase
      .from('users')
      .select('id, tenant_id')
      .eq('email', email)
      .eq('scope', 'tenant_owner')
      .maybeSingle();

    if (existingOwner) {
      res.status(409).json({ success: false, error: 'Email is already in use. Please use a different email address.' });
      return;
    }

    // Check subdomain availability
    const { data: existing } = await supabase
      .from('tenants')
      .select('id')
      .eq('subdomain', subdomain)
      .maybeSingle();

    if (existing) {
      res.status(409).json({ success: false, error: 'Subdomain is already taken' });
      return;
    }

    const billing = getSaasBillingService();
    const tenantId = crypto.randomUUID();

    const result = await billing.createCheckoutSession({
      tenantId,
      tier,
      operatorEmail: email,
      operatorName: name,
      subdomain,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    logger.error('[PLATFORM] createCheckoutSession error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// ============================================
// Billing portal (operator self-service)
// ============================================

export async function getBillingPortal(req: Request, res: Response): Promise<void> {
  try {
    const tenant = req.tenant;

    if (!tenant?.stripe_customer_id) {
      res.status(404).json({ success: false, error: 'No billing account found for this tenant' });
      return;
    }

    const billing = getSaasBillingService();
    const { url } = await billing.createPortalSession(tenant.stripe_customer_id);

    res.json({ success: true, data: { url } });
  } catch (err) {
    logger.error('[PLATFORM] getBillingPortal error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// ============================================
// Public plans (pricing page)
// ============================================

export async function getPublicPlans(_req: Request, res: Response): Promise<void> {
  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('plans')
      .select('id, code, name, description, price_monthly_cents, price_annual_cents, feature_limits, sort_order')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      res.status(500).json({ success: false, error: error.message });
      return;
    }

    res.json({ success: true, data: data ?? [] });
  } catch (err) {
    logger.error('[PLATFORM] getPublicPlans error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// ============================================
// Helpers
// ============================================

/**
 * Build a tier → price_monthly_cents map from the live plans table.
 * Used by getRevenueOverview() and getPlatformStats() so MRR reflects
 * whatever prices are actually set in the admin Plans CRUD, instead of a
 * separate hardcoded/env-var copy that drifts the moment someone edits a
 * plan's price without also remembering to update these env vars.
 *
 * Falls back to the env var (or its hardcoded default) per-tier only if
 * the plans table has no active row for that code — non-fatal, same
 * pattern used everywhere else this codebase reads plan data.
 */
async function resolveTierMrrMap(): Promise<Record<SubscriptionTier, number>> {
  const fallback: Record<SubscriptionTier, number> = {
    starter: parseInt(process.env.PRICE_STARTER_MONTHLY_CENTS || '9900', 10),
    growth: parseInt(process.env.PRICE_GROWTH_MONTHLY_CENTS || '29900', 10),
    enterprise: parseInt(process.env.PRICE_ENTERPRISE_MONTHLY_CENTS || '99900', 10),
  };

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('plans')
      .select('code, price_monthly_cents')
      .eq('is_active', true);

    if (error || !data) {
      logger.warn('[PLATFORM] plans lookup failed for MRR calc, falling back to env vars', { error: error?.message });
      return fallback;
    }

    const map = { ...fallback };
    for (const row of data) {
      if (row.code === 'starter' || row.code === 'growth' || row.code === 'enterprise') {
        map[row.code as SubscriptionTier] = row.price_monthly_cents;
      }
    }
    return map;
  } catch (err) {
    logger.error('[PLATFORM] Unexpected error resolving tier MRR map, falling back to env vars', err);
    return fallback;
  }
}

async function updateTenantBillingStatus(
  req: Request,
  res: Response,
  status: 'active' | 'suspended',
): Promise<void> {
  try {
    const { id } = req.params;
    const supabase = getSupabase();

    const { data: tenant } = await supabase
      .from('tenants')
      .select('stripe_subscription_id, subdomain')
      .eq('id', id)
      .maybeSingle();

    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    await supabase
      .from('tenants')
      .update({ billing_status: status, updated_at: new Date().toISOString() })
      .eq('id', id);

    invalidateTenantCache(id, tenant.subdomain);

    logger.info('[PLATFORM] Tenant billing status updated', { id, status });
    res.json({ success: true, data: { id, billing_status: status } });
  } catch (err) {
    logger.error('[PLATFORM] updateBillingStatus error', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

// ============================================
// Public: Validate tenant by slug (no auth)
// ============================================

export async function getTenantBySlug(req: Request, res: Response): Promise<void> {
  try {
    const { slug } = req.params;
    const supabase = getSupabase();

    const { data, error } = await supabase
      .from('tenants')
      .select('id, subdomain, billing_status')
      .eq('subdomain', slug)
      .maybeSingle();

    if (error || !data) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }

    res.json({ success: true, data });
  } catch (err) {
    logger.error('[TENANT] Error validating tenant by slug', err);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}

