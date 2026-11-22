/**
 * Tenant Access Middleware
 *
 * Resolves the calling tenant from request context using four strategies,
 * tried in priority order:
 *
 *   1. X-Tenant-ID header     — UUID, used by internal API callers
 *   2. X-Tenant-Slug header   — slug string, set by the frontend when it knows
 *                               the tenant from a URL path segment (e.g. /app/[slug]).
 *                               This supports path-based multi-tenancy without
 *                               requiring wildcard subdomains or a custom domain.
 *   3. Host subdomain         — future: works once a wildcard domain is configured.
 *                               Currently a no-op on localhost, vercel.app, and
 *                               onrender.com hosts.
 *   4. is_platform_root       — final fallback when none of the above produced a
 *                               signal at all (bare platform domain, no headers).
 *                               Resolves to the single tenant flagged
 *                               is_platform_root = true so the platform operator's
 *                               own tenant (login, settings, modules) works on its
 *                               bare domain without needing a header or subdomain.
 *
 * Billing gate rules (two-tier — see validateTenantBilling below):
 *   active / trialing          → allow through, no header added
 *   past_due                   → reads (GET/HEAD/OPTIONS) pass with
 *                                 X-Billing-Warning on operator paths; writes
 *                                 are blocked. Operator surfaces get an
 *                                 actionable 402; public storefront surfaces
 *                                 get a sanitized 503 (no billing leakage).
 *   suspended / cancelled      → blocked. Operator surfaces get an actionable
 *                                 402 (suspended tenants can still GET the
 *                                 Stripe portal for self-service); public
 *                                 surfaces get a sanitized 503.
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
import { cache } from '../utils/cache.js';

// ============================================
// Types
// ============================================

export type BillingStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
export type SubscriptionTier = 'starter' | 'growth' | 'enterprise' | (string & {});

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
  /**
   * FK to plans.id. When set, feature_limits above is resolved LIVE off
   * this plan on every lookup (see lookupTenant() below) — editing the
   * plan's feature_limits in the admin Plans CRUD takes effect immediately
   * for every tenant on that plan, within CACHE_TTL_MS. When null (legacy
   * tenant with no matching plan row), feature_limits falls back to
   * whatever snapshot is stored directly on this tenant row.
   */
  plan_id: string | null;
  /**
   * True for exactly one tenant — the platform operator's own tenant
   * (seeded in 20260621000000_seed_platform_tenant.sql, flagged in
   * 20260621170000_add_platform_root_tenant_flag.sql). DB-enforced
   * uniqueness via a partial unique index. This is the gate for
   * provision_tenant_on_activate — see modules.controller.ts createModule
   * and saas-webhook.controller.ts checkout.session.completed.
   */
  is_platform_root: boolean;
}

// Augment Express Request with tenant context
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
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
 * Returns null if the host is bare (no subdomain), localhost, a Vercel
 * preview URL, or a Render default hostname — none of these have
 * meaningful per-tenant subdomains yet.
 *
 * Will become useful once a wildcard custom domain is configured.
 */
function extractSubdomain(host: string | undefined): string | null {
  if (!host) return null;

  const hostname = host.split(':')[0];

  // Skip Vercel preview URLs — they're not tenant-routed
  if (hostname.endsWith('.vercel.app')) return null;

  // Skip Render's default hostnames — e.g. "v2-ecosystem-backend.onrender.com"
  // has the same subdomain.domain.tld shape as a real tenant subdomain, but
  // "v2-ecosystem-backend" is the Render service name, not a tenant slug.
  // Without this exclusion, resolveTenant() treats it as an (unresolvable)
  // tenant subdomain and 404s "Tenant not found" on every request that
  // doesn't carry an explicit tenant header — including login.
  if (hostname.endsWith('.onrender.com')) return null;

  // Localhost — support subdomain in dev: "acme.localhost"
  if (hostname === 'localhost' || hostname === '127.0.0.1') return null;

  let sub: string | null = null;
  if (hostname.endsWith('.localhost')) {
    sub = hostname.slice(0, hostname.lastIndexOf('.localhost'));
  } else {
    const parts = hostname.split('.');
    if (parts.length > 2) {
      sub = parts[0];
    }
  }

  if (sub) {
    const reserved = ['api', 'admin', 'app', 'assets', 'www'];
    if (reserved.includes(sub.toLowerCase())) {
      return null;
    }
    return sub;
  }

  return null;
}

// ============================================
// Tenant lookup (with Redis cache)
// ============================================

const CACHE_TTL = 300; // 5 minutes - increased from 30s to reduce cache misses and eliminate 1000ms spikes
const CACHE_KEY_PREFIX = 'tenant:';

async function getCached(key: string): Promise<TenantRecord | null | undefined> {
  try {
    // cache.get() returns null for BOTH "cache miss" and "Redis unavailable" —
    // that's indistinguishable from a legitimately-cached negative result
    // ("we looked this tenant up before and confirmed it doesn't exist").
    // Wrap the stored value so we can tell those apart: an actual miss comes
    // back as `null` here (undefined-equivalent, "go check the DB"), while a
    // real cache hit — positive or negative — comes back as `{ tenant }`.
    const cached = await cache.get<{ tenant: TenantRecord | null }>(`${CACHE_KEY_PREFIX}${key}`);
    if (cached === null) return undefined;
    return cached.tenant;
  } catch {
    return undefined;
  }
}

async function setCached(key: string, tenant: TenantRecord | null): Promise<void> {
  try {
    await cache.set(`${CACHE_KEY_PREFIX}${key}`, { tenant }, CACHE_TTL);
  } catch {
    // Silent fail - cache is best-effort
  }
}

async function lookupTenant(key: string, field: 'id' | 'subdomain'): Promise<TenantRecord | null> {
  const cacheKey = `${field}:${key}`;
  const cached = await getCached(cacheKey);
  if (cached !== undefined) return cached;

  try {
    const supabase = getSupabase();
    // Embed the linked plan's feature_limits via the plan_id FK — this is
    // what makes editing a plan's limits in the admin CRUD apply live to
    // every tenant on that plan, instead of relying on the one-time
    // snapshot copied onto tenants.feature_limits at provisioning time.
    const { data, error } = await supabase
      .from('tenants')
      .select('*, plan:plans(feature_limits)')
      .eq(field, key)
      .maybeSingle();

    if (error) {
      logger.warn('[TENANT] Lookup error', { field, key, error: error.message });
      return null;
    }

    let tenant: TenantRecord | null = null;
    if (data) {
      const { plan, ...tenantFields } = data as TenantRecord & {
        plan?: { feature_limits: Record<string, unknown> } | null;
      };
      tenant = {
        ...tenantFields,
        // Live plan limits win when a plan is linked; otherwise keep
        // whatever snapshot is on the tenant row (legacy / no plan_id).
        feature_limits: plan?.feature_limits ?? tenantFields.feature_limits,
      };
    }

    await setCached(cacheKey, tenant);
    return tenant;
  } catch (err) {
    logger.error('[TENANT] Unexpected lookup failure', { field, key, err });
    return null;
  }
}

const PLATFORM_ROOT_CACHE_KEY = 'platform_root';

/**
 * Look up the single tenant flagged is_platform_root = true.
 * This is the final fallback for resolveTenant(): when no ID/slug/subdomain
 * signal is present at all (e.g. requests hitting the bare Vercel/Render
 * domain), we still want req.tenant set to the platform operator's own
 * tenant rather than left undefined — that's what makes /api/settings and
 * /api/modules resolve real platform content instead of falling back to
 * frontend placeholder defaults.
 */
async function lookupPlatformRootTenant(): Promise<TenantRecord | null> {
  const cached = await getCached(PLATFORM_ROOT_CACHE_KEY);
  if (cached !== undefined) return cached;

  try {
    const supabase = getSupabase();
    const { data, error } = await supabase
      .from('tenants')
      .select('*, plan:plans(feature_limits)')
      .eq('is_platform_root', true)
      .maybeSingle();

    if (error) {
      logger.warn('[TENANT] Platform-root lookup error', { error: error.message });
      return null;
    }

    let tenant: TenantRecord | null = null;
    if (data) {
      const { plan, ...tenantFields } = data as TenantRecord & {
        plan?: { feature_limits: Record<string, unknown> } | null;
      };
      tenant = {
        ...tenantFields,
        feature_limits: plan?.feature_limits ?? tenantFields.feature_limits,
      };
    }

    await setCached(PLATFORM_ROOT_CACHE_KEY, tenant);
    return tenant;
  } catch (err) {
    logger.error('[TENANT] Unexpected platform-root lookup failure', { err });
    return null;
  }
}

/** Invalidate cache for a tenant (call after billing_status updates). */
export async function invalidateTenantCache(tenantId: string, subdomain?: string): Promise<void> {
  try {
    await cache.del(`${CACHE_KEY_PREFIX}id:${tenantId}`);
    if (subdomain) await cache.del(`${CACHE_KEY_PREFIX}subdomain:${subdomain}`);
    // Also drop the platform-root cache entry — if this update was to the
    // platform tenant itself, a stale cached copy would otherwise linger
    // for up to CACHE_TTL seconds after a billing_status change.
    await cache.del(`${CACHE_KEY_PREFIX}${PLATFORM_ROOT_CACHE_KEY}`);
  } catch {
    // Silent fail
  }
}

// ============================================
// Middleware
// ============================================

/**
 * Resolve tenant from request context and attach to req.tenant.
 *
 * Resolution order:
 *   1. X-Tenant-ID header   (UUID — internal/API callers)
 *   2. X-Tenant-Slug header (slug — frontend path-based routing, e.g. /app/[slug])
 *   3. Host subdomain       (future — requires wildcard custom domain)
 *   4. is_platform_root     (final fallback — bare platform domain, no signal at all)
 *
 * Does NOT gate access — use validateTenantBilling for that.
 */
export async function resolveTenant(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.skipTenantGate) return next();

  // Priority 1: explicit ID header (internal API callers)
  const tenantIdHeader = req.headers['x-tenant-id'] as string | undefined;
  if (tenantIdHeader) {
    const tenant = await lookupTenant(tenantIdHeader, 'id');
    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }
    req.tenant = tenant;
    return next();
  }

  // Priority 2: slug header (frontend sets this from URL path segment)
  // This is how path-based multi-tenancy works without a custom domain:
  // frontend reads the slug from the URL, sends it as X-Tenant-Slug,
  // and the backend resolves the tenant without subdomain routing.
  // If a slug was explicitly provided but resolves to nothing, try the
  // platform-root tenant before hard-404ing.  In dev, the frontend runs
  // on default.localhost and the Axios interceptor sends X-Tenant-Slug:
  // "default" — but no tenant row has subdomain = 'default'.  Falling
  // back to the platform root is the correct resolution for that case,
  // and safe in production because only an unknown slug triggers the path.
  const tenantSlugHeader = req.headers['x-tenant-slug'] as string | undefined;
  if (tenantSlugHeader) {
    const tenant = await lookupTenant(tenantSlugHeader, 'subdomain');
    if (tenant) {
      req.tenant = tenant;
      return next();
    }
    // Only in non-production environments with the literal 'default' placeholder
    // slug may we fallback to platform-root; all other unknown slugs MUST 404 fail-closed.
    if (process.env.NODE_ENV !== 'production' && tenantSlugHeader === 'default') {
      const platformRoot = await lookupPlatformRootTenant();
      if (platformRoot) {
        req.tenant = platformRoot;
        return next();
      }
    }
    res.status(404).json({ success: false, error: 'Tenant not found' });
    return;
  }

  // Priority 3: subdomain (future — no-op until wildcard domain is configured)
  // Same rule: if a subdomain is extracted but resolves to nothing, 404.
  const subdomain = extractSubdomain(req.headers.host);
  if (subdomain) {
    const tenant = await lookupTenant(subdomain, 'subdomain');
    if (!tenant) {
      res.status(404).json({ success: false, error: 'Tenant not found' });
      return;
    }
    req.tenant = tenant;
    return next();
  }

  // Priority 4: platform-root fallback — no ID header, no slug header, and
  // no tenant-bearing subdomain at all (e.g. the bare vercel.app/onrender.com
  // domain). Rather than leaving req.tenant unset (which used to silently
  // fall through to "legacy single-tenant mode" and break login + settings
  // resolution for the platform tenant itself), resolve to whichever tenant
  // is flagged is_platform_root. If that lookup also comes back empty
  // (platform tenant not yet seeded), fall through unset as before.
  const platformTenant = await lookupPlatformRootTenant();
  if (platformTenant) {
    req.tenant = platformTenant;
  }

  next();
}

/**
 * Gate access based on tenant billing status.
 * Must run after resolveTenant.
 *
 * TWO-TIER RESPONSE ARCHITECTURE:
 *
 * The 402 payload is a SaaS-billing internal — the caller being blocked may be
 * an anonymous end-customer browsing a storefront (public Engine A catalog,
 * Engine B availability, etc.), who has no V2 subscription and should never
 * see "update your payment method". That text exposes the tenant's private
 * billing dispute to the tenant's own customers and reads as nonsense to them.
 *
 *   Tier 1 — Operator surfaces (paths under /api/v1/{admin,staff,platform}):
 *     These requests come from authenticated operator UIs. They get the raw
 *     402 + actionable billing message + billing_status payload so the admin
 *     frontend can render an actionable "update payment method" state.
 *
 *   Tier 2 — Public storefront surfaces (everything else):
 *     Sanitized 503 Service Unavailable with a neutral maintenance message.
 *     The real cause goes to server logs only. X-Billing-Warning is likewise
 *     suppressed — no billing signals leak to guests.
 *
 * Self-service exception: an operator whose subscription is suspended must
 * still be able to open the Stripe Customer Portal to fix payment, otherwise
 * the suspension is a dead end. GET /api/v1/platform/billing/portal is
 * exempted from the block while suspended (still never served to public
 * paths). The Flutterwave/Stripe webhook exemption is upstream via skipTenantGate.
 *
 * GET / HEAD / OPTIONS pass through for past_due tenants with an
 * X-Billing-Warning header on operator paths; all write methods
 * (POST/PUT/PATCH/DELETE/etc.) are blocked — the doc's "PASS reads / BLOCK
 * writes" rule.
 *
 * Fails closed if no tenant is resolved. There is no more "single-tenant
 * legacy mode" — the product is fully multi-tenant, and the old passthrough
 * here was a leftover from before that was true, not a deliberate exception.
 * It contradicted the fail-closed pattern resolveTenant already uses for
 * every other "couldn't identify a tenant" case (see the hard 404s above).
 * Given resolveTenant now actively falls back to the platform-root tenant,
 * req.tenant should only be unset here in the brief post-install window
 * before that tenant is seeded — which is exactly when nothing should be
 * proceeding past this gate anyway.
 */
export async function validateTenantBilling(req: Request, res: Response, next: NextFunction): Promise<void> {
  if (req.skipTenantGate) return next();

  const tenant = req.tenant;

  if (!tenant) {
    logger.warn('[TENANT] Blocked request — no tenant resolved', {
      path: req.path,
      method: req.method,
    });
    res.status(404).json({ success: false, error: 'Tenant not found' });
    return;
  }

  // Operator surfaces run behind authenticate() downstream (admin.routes,
  // staff.routes, platform.routes all call it first thing inside their
  // routers) — this gate runs before that, so identity is unknown here and
  // the path topology is the caller-class signal. resolveTenant guarantees
  // any /{admin,staff,platform}/... request was issued by an operator UI.
  // Fail-safe default: a request with NO path context (only possible in
  // unit-test mocks — real Express requests always carry both originalUrl
  // and path) is treated as a public surface, so billing payload details
  // fail CLOSED rather than leak.
  const callerPath = req.originalUrl || req.path || '';
  const isOperatorSurface = /^\/api\/v1\/(?:admin|staff|platform)(?:\/|$)/.test(callerPath);

  /** Neutral guest-facing shutdown payload — no SaaS billing vocabulary. */
  const publicUnavailable = (res: Response): void => {
    res.status(503).json({
      success: false,
      error: 'This service is temporarily unavailable while updates are underway. Please check back shortly.',
      // Opaque maintenance prefix so the operator can correlate server logs.
      code: 'SERVICE_UNAVAILABLE',
    });
    return;
  };

  const { billing_status, id, subdomain } = tenant;

  if (billing_status === 'suspended' || billing_status === 'cancelled') {
    // Self-service lifeline: let a suspended operator reach the Stripe portal
    // so they can fix payment. GET only, operator paths only. ('cancelled' is
    // deliberately NOT included — reactivation goes through support.)
    if (
      billing_status === 'suspended' &&
      req.method === 'GET' &&
      /^\/api\/v1\/platform\/billing\/portal(?:\/|$)/.test(callerPath)
    ) {
      logger.info('[TENANT] Suspended tenant accessing billing portal self-service', { tenantId: id, subdomain });
      return next();
    }

    logger.warn('[TENANT] Blocked request — billing status gate', {
      tenantId: id,
      subdomain,
      billing_status,
      path: req.path,
      method: req.method,
      callerSurface: isOperatorSurface ? 'operator' : 'public',
    });

    if (!isOperatorSurface) {
      publicUnavailable(res);
      return;
    }

    res.status(402).json({
      success: false,
      error: billing_status === 'suspended'
        ? 'Your subscription is suspended due to a payment issue. Please update your payment method.'
        : 'This account has been cancelled. Please contact support to reactivate.',
      billing_status,
      tenantId: id,
      // Actionable for the admin UI: exact path to self-service payment fix.
      billing_portal_available: billing_status === 'suspended',
    });
    return;
  }

  if (billing_status === 'past_due') {
    const isWriteMethod = req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS';
    const isPortalPath = /^\/api\/v1\/platform\/billing\/portal(?:\/|$)/.test(callerPath);

    // Warn header is an operator channel — never sent to public storefronts.
    if (isOperatorSurface) {
      res.setHeader('X-Billing-Warning', 'payment_overdue');
    }

    if (isWriteMethod) {
      logger.warn('[TENANT] Blocked write — past_due grace period is read-only', {
        tenantId: id,
        subdomain,
        path: req.path,
        method: req.method,
        callerSurface: isOperatorSurface ? 'operator' : 'public',
      });

      if (!isOperatorSurface) {
        publicUnavailable(res);
        return;
      }

      res.status(402).json({
        success: false,
        error: 'Your subscription payment is overdue. Read access remains available, but changes are blocked until payment is updated.',
        billing_status,
        tenantId: id,
        billing_portal_available: true,
      });
      return;
    }

    // portal GET while suspended is handled above; past_due portal GET reads
    // (Stripe portal works with failed cards) fall through normally.
    if (!isPortalPath) {
      logger.info('[TENANT] Past-due tenant allowed read access with warning', { tenantId: id, subdomain });
    }
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
