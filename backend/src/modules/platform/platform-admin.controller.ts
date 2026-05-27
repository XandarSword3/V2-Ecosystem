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
      .select('id, subdomain, subscription_tier, billing_status, trial_ends_at, created_at, stripe_customer_id', { count: 'exact' })
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

    res.json({
      success: true,
      data: data ?? [],
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

    // Fetch property count
    const { count: propertyCount } = await supabase
      .from('properties')
      .select('id', { count: 'exact', head: true })
      .eq('group_id', tenant.property_group_id);

    // Fetch module count
    const { count: moduleCount } = await supabase
      .from('modules')
      .select('id', { count: 'exact', head: true })
      .in(
        'property_id',
        await getPropertyIds(supabase, tenant.property_group_id),
      );

    res.json({
      success: true,
      data: { ...tenant, propertyCount: propertyCount ?? 0, moduleCount: moduleCount ?? 0 },
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

    if (!tier || !['starter', 'growth', 'enterprise'].includes(tier)) {
      res.status(400).json({ success: false, error: 'Invalid tier. Must be starter, growth, or enterprise.' });
      return;
    }

    const supabase = getSupabase();
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

    // Sync tier locally
    await supabase
      .from('tenants')
      .update({ subscription_tier: tier, updated_at: new Date().toISOString() })
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

    const tierMrr: Record<SubscriptionTier, number> = {
      starter: parseInt(process.env.PRICE_STARTER_MONTHLY_CENTS || '9900', 10),
      growth: parseInt(process.env.PRICE_GROWTH_MONTHLY_CENTS || '29900', 10),
      enterprise: parseInt(process.env.PRICE_ENTERPRISE_MONTHLY_CENTS || '99900', 10),
    };

    const counts = { starter: 0, growth: 0, enterprise: 0, total: 0 };
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

    const tierMrr: Record<string, number> = {
      starter:    parseInt(process.env.PRICE_STARTER_MONTHLY_CENTS  || '9900',  10),
      growth:     parseInt(process.env.PRICE_GROWTH_MONTHLY_CENTS   || '29900', 10),
      enterprise: parseInt(process.env.PRICE_ENTERPRISE_MONTHLY_CENTS || '99900', 10),
    };

    let totalMrr = 0;
    let activeTenants = 0;
    let trialingTenants = 0;
    let suspendedTenants = 0;

    for (const t of rows) {
      if (t.billing_status === 'active' || t.billing_status === 'past_due') {
        totalMrr += tierMrr[t.subscription_tier] ?? 0;
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
        .reduce((sum, t) => sum + (tierMrr[t.subscription_tier] ?? 0), 0);
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

    // Check subdomain availability
    const supabase = getSupabase();
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
// Helpers
// ============================================

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

async function getPropertyIds(
  supabase: ReturnType<typeof getSupabase>,
  groupId: string,
): Promise<string[]> {
  const { data } = await supabase
    .from('properties')
    .select('id')
    .eq('group_id', groupId);
  return (data ?? []).map((p) => p.id);
}
