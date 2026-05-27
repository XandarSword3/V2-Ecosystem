/**
 * Tenant Access Middleware
 *
 * Resolves the calling tenant from request context using three strategies,
 * tried in priority order:
 *
 *   1. X-Tenant-ID header     — UUID, used by internal API callers
 *   2. X-Tenant-Slug header   — slug string, set by the frontend when it knows
 *                               the tenant from a URL path segment (e.g. /app/[slug]).
 *                               This supports path-based multi-tenancy without
 *                               requiring wildcard subdomains or a custom domain.
 *   3. Host subdomain         — future: works once a wildcard domain is configured.
 *                               Currently a no-op on localhost and vercel.app hosts.
 *
 * Billing gate rules:
 *   active / trialing          → allow through, no header added
 *   past_due                   → allow through, attach X-Billing-Warning header
 *   suspended / cancelled      → 402 Payment Required, request blocked
 *   tenant not found           → pass through (legacy single-tenant mode)
 *
 * This middleware must run BEFORE validatePropertyAccess so that suspended
 * tenants are rejected before any property-level logic executes.
 *
 * Routes exempt from tenant gating (set req.skipTenantGate = true upstream):
 *   POST /api/webhooks/stripe/saas   — webhook must land even when suspended
 *   GET  /api/install/status         — pre-tenant bootstrap route
 *   GET  /api/health                 — infrastructure health checks
 */

import { Request, Response, NextFunction } from 'express';
import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';

// ============================================
// Types
// ============================================

export type BillingStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
export type SubscriptionTier = 'starter' | 'growth' | 'enterprise';

export interface TenantRecord {
  id: string;
  subdomain: string;
  property_group_id: string;
  subscription_tier: SubscriptionTier;
  billing_status: BillingStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  feature_limits: Record<string, unknown>;
  trial_ends_at: string | null;
  created_at: string;
}

// Augment Express Request with tenant context
declare global {
  namespace Express {
    interface Request {
      tenant?: TenantRecord;
      skipTenantGate?: boolean;
    }
  }
}

// ============================================
// Subdomain resolver
// ============================================

/**
 * Extract the subdomain from the Host header.
 * Returns null if the host is bare (no subdomain), localhost, or a Vercel
 * preview URL — none of these have meaningful per-tenant subdomains yet.
 *
 * Will become useful once a wildcard custom domain is configured.
 */
function extractSubdomain(host: string | undefined): string | null {
  if (!host) return null;

  const hostname = host.split(':')[0];

  // Skip Vercel preview URLs — they're not tenant-routed
  if (hostname.endsWith('.vercel.app')) return null;

  // Localhost — support subdomain in dev: "acme.localhost"
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;
  if (hostname.endsWith('.localhost')) {
    const sub = hostname.slice(0, hostname.lastIndexOf('.localhost'));
    return sub || null;
  }

  const parts = hostname.split('.');
  if (parts.length <= 2) return null; // bare domain, no subdomain
  return parts[0];
}

// ============================================
// Tenant lookup (with short-lived in-process cache)
// ============================================

const CACHE_TTL_MS = 30_000; // 30 s — short enough to pick up billing_status changes
interface CacheEntry {
  tenant: TenantRecord | null;
  fetchedAt: number;
}
const tenantCache = new Map<string, CacheEntry>();

async function lookupTenant(key: string, field: 'id' | 'subdomain'): Promise<TenantRecord | null> {
  const cacheKey = `${field}:${key}`;
  const cached = tenantCache.get(cacheKey);
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.tenant;
  }

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('tenants')
      .select('*')
      .eq(field, key)
      .maybeSingle();

    if (error) {
      logger.warn('[TENANT] Lookup error', { field, key, error: error.message });
      return null;
    }

    const tenant = (data as TenantRecord) ?? null;
    tenantCache.set(cacheKey, { tenant, fetchedAt: Date.now() });
    return tenant;
  } catch (err) {
    logger.error('[TENANT] Unexpected lookup failure', { field, key, err });
    return null;
  }
}

/** Invalidate cache for a tenant (call after billing_status updates). */
export function invalidateTenantCache(tenantId: string, subdomain?: string): void {
  tenantCache.delete(`id:${tenantId}`);
  if (subdomain) tenantCache.delete(`subdomain:${subdomain}`);
}

// ============================================
// Middleware
// ============================================

/**
 * Resolve tenant from request context and attach to req.tenant.
 *
 * Resolution order:
 *   1. X-Tenant-ID header  (UUID — internal/API callers)
 *   2. X-Tenant-Slug header (slug — frontend path-based routing, e.g. /app/[slug])
 *   3. Host subdomain       (future — requires wildcard custom domain)
 *
 * Does NOT gate access — use validateTenantBilling for that.
 */
export async function resolveTenant(req: Request, _res: Response, next: NextFunction): Promise<void> {
  if (req.skipTenantGate) return next();

  // Priority 1: explicit ID header (internal API callers)
  const tenantIdHeader = req.headers['x-tenant-id'] as string | undefined;
  if (tenantIdHeader) {
    const tenant = await lookupTenant(tenantIdHeader, 'id');
    if (tenant) req.tenant = tenant;
    return next();
  }

  // Priority 2: slug header (frontend sets this from URL path segment)
  // This is how path-based multi-tenancy works without a custom domain:
  // frontend reads the slug from the URL, sends it as X-Tenant-Slug,
  // and the backend resolves the tenant without subdomain routing.
  const tenantSlugHeader = req.headers['x-tenant-slug'] as string | undefined;
  if (tenantSlugHeader) {
    const tenant = await lookupTenant(tenantSlugHeader, 'subdomain');
    if (tenant) req.tenant = tenant;
    return next();
  }

  // Priority 3: subdomain (future — no-op until wildcard domain is configured)
  const subdomain = extractSubdomain(req.headers.host);
  if (subdomain) {
    const tenant = await lookupTenant(subdomain, 'subdomain');
    if (tenant) req.tenant = tenant;
  }

  next();
}

/**
 * Gate access based on tenant billing status.
 * Must run after resolveTenant.
 *
 * Returns 402 for suspended/cancelled tenants.
 * Attaches X-Billing-Warning for past_due tenants and continues.
 * Passes through if no tenant is resolved (single-tenant legacy mode).
 */
export async function validateTenantBilling(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.skipTenantGate) return next();

  const tenant = req.tenant;

  // No tenant resolved — legacy single-tenant deployment, allow through
  if (!tenant) return next();

  const { billing_status, id, subdomain } = tenant;

  if (billing_status === 'suspended' || billing_status === 'cancelled') {
    logger.warn('[TENANT] Blocked request — billing status gate', {
      tenantId: id,
      subdomain,
      billing_status,
      path: req.path,
      method: req.method,
    });

    res.status(402).json({
      success: false,
      error: billing_status === 'suspended'
        ? 'Your subscription is suspended due to a payment issue. Please update your payment method.'
        : 'This account has been cancelled. Please contact support to reactivate.',
      billing_status,
      tenantId: id,
    });
    return;
  }

  if (billing_status === 'past_due') {
    res.setHeader('X-Billing-Warning', 'payment_overdue');
    logger.info('[TENANT] Past-due tenant allowed through with warning', { tenantId: id, subdomain });
  }

  next();
}

/**
 * Combined middleware: resolve + gate in a single use() call.
 * Equivalent to app.use(resolveTenant, validateTenantBilling).
 */
export async function tenantGate(req: Request, res: Response, next: NextFunction): Promise<void> {
  await resolveTenant(req, res, () => {
    validateTenantBilling(req, res, next);
  });
}

/**
 * Mark a route as exempt from tenant gating (e.g. webhooks, health checks).
 * Apply this before tenantGate in the middleware chain.
 */
export function skipTenantGate(req: Request, _res: Response, next: NextFunction): void {
  req.skipTenantGate = true;
  next();
}
