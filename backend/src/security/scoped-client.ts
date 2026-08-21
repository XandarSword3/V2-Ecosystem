import { getSupabase } from '../database/connection.js';
import { logger } from '../utils/logger.js';
import { getCallerTenantId } from './tenant-scope.js';
import type { Request } from 'express';

/**
 * Phase 2 (item 2.1) of the tenant-isolation remediation plan.
 *
 * Phase 0 fixed known instances of "forgot to scope this query by tenant."
 * Phase 1 added a lint guard against reintroducing the specific header-based
 * version of that bug. Neither stops the *next* unknown instance — a
 * developer (human or AI) can still write `getSupabase().from('modules')...`
 * and simply forget the `.eq('tenant_id', ...)` filter, because nothing
 * makes that mandatory.
 *
 * getScopedClient() is that mandatory path: a drop-in-shaped wrapper around
 * the real Supabase client that auto-applies tenant scoping for any table
 * registered below, so forgetting isn't possible for those tables — the
 * scoping happens inside .select()/.insert()/.update()/.delete()/.upsert()
 * themselves, before the caller gets the query builder back.
 *
 * This does NOT retroactively fix every table in the schema. It only
 * protects tables in TENANT_SCOPED_TABLES below. Migrating a table means:
 *   1. Confirm it actually has a tenant_id column (check migrations).
 *   2. Add it to TENANT_SCOPED_TABLES.
 *   3. Swap `getSupabase()` for `getScopedClient(ctx)` at call sites for
 *      that table, per remediation-plan item 2.4 (module by module).
 * Everything else still goes through the raw client, unprotected — see
 * item 2.3's coverage script for what's left.
 */

/** Tables confirmed (via migration history) to have a tenant_id column. */
const TENANT_SCOPED_TABLES = new Set([
  'modules',
  'entity_customizations',
  'customization_groups',
  'customization_options',
  'order_customizations',
  // Added as part of the cross-tenant IDOR sweep (see CONTEXT.md):
  'roles',
  'staff_profiles',
  'gift_cards',
  'coupons',
  'reviews',
  'payments',
  'payment_ledger',
  // Fiscal engine (migration 20260821010000) — tenant-scoped like the rest.
  'fiscal_profiles',
  'fiscal_document_series',
  'fiscal_documents',
  'fiscal_submissions',
]);

/**
 * `transactions` is deliberately NOT registered here, even though several of
 * the payments-module fixes above read/write it (postRoomCharge,
 * settleFolioBalance, recordCashPayment/recordManualPayment's reference
 * lookups). It's the unified table underpinning all five engines and has an
 * enormous number of call sites across the codebase — auto-scoping it here
 * would only affect sites explicitly migrated to getScopedClient, but
 * verifying that's safe for `transactions` specifically means auditing far
 * more of the codebase than the payments sweep covered. Those specific
 * fetches are scoped manually instead (see payment.controller.ts) until
 * `transactions` gets its own dedicated review.
 */

/**
 * gift_cards / coupons / reviews are registered above so any call site NOT
 * already covered gets tenant_id auto-scoping by default. But the admin
 * controllers for these three (giftcard.controller.ts, coupon.controller.ts,
 * reviews.controller.ts) deliberately do NOT route through getScopedClient()
 * for their property-scoped admin endpoints — they scope by property_id via
 * validatePropertyAccess + requirePropertyId instead. That's intentional:
 * validatePropertyAccess has an explicit super_admin bypass allowing a
 * platform admin to act on any property across ANY tenant. If those
 * endpoints were switched to getScopedClient's automatic tenant_id filter,
 * a super_admin homed to Tenant A would be silently blocked from a Tenant B
 * property their role is supposed to reach — the two scoping mechanisms
 * would fight each other. roles has no property_id dimension and no such
 * bypass, so it's a clean fit and IS fully migrated (see
 * roles.controller.ts / permissions.controller.ts).
 */

export interface TenantContext {
  /** null means super_admin — genuinely unscoped, not "forgot to set it." */
  tenantId: string | null;
  /** For logging only — who made this unscoped call, if tenantId is null. */
  actorId?: string;
}

/**
 * Build a TenantContext from a request. JWT-derived only (via
 * getCallerTenantId) — never the x-tenant-id header. This is the only
 * intended way to construct a TenantContext from live request handling;
 * everywhere else (scripts, tests) should build one explicitly and
 * deliberately.
 */
export function tenantContextFor(req: Request): TenantContext {
  return {
    tenantId: getCallerTenantId(req),
    actorId: req.user?.userId,
  };
}

function stampTenantId<T extends Record<string, unknown>>(row: T, tenantId: string | null): T {
  // super_admin (tenantId === null): don't clobber a tenant_id the caller
  // explicitly set (e.g. provisioning a specific tenant, or a deliberate
  // global/null row) — same behavior Phase 0's fixes preserved.
  if (tenantId === null) return row;
  return { ...row, tenant_id: tenantId };
}

/**
 * Returns a Supabase-client-shaped object where .from(table), for any table
 * in TENANT_SCOPED_TABLES, automatically:
 *   - .select() / .update() / .delete() → chains .eq('tenant_id', tenantId)
 *     onto the returned query builder before handing it back, so every
 *     further .eq()/.order()/.single()/etc the caller chains on operates on
 *     an already-scoped query. Reads/writes to another tenant's row simply
 *     won't match, same 404-style behavior as the Phase 0 manual fixes.
 *   - .insert() / .upsert() → stamps tenant_id onto the row(s) being
 *     written, so a write can't land under the wrong tenant (or no tenant).
 *   - super_admin (ctx.tenantId === null) → select/update/delete pass
 *     through UNSCOPED, but every such call is logged. This is the
 *     "explicit, logged, unscoped variant" the remediation plan calls for —
 *     not a silent bypass.
 * Tables not in the registry pass through entirely untouched — same as
 * calling getSupabase() directly. That's deliberate: this wrapper should
 * never silently start scoping a table nobody's verified.
 */
export function getScopedClient(ctx: TenantContext) {
  const supabase = getSupabase();

  return {
    from(table: string) {
      const queryBuilder = supabase.from(table);

      if (!TENANT_SCOPED_TABLES.has(table)) {
        return queryBuilder;
      }

      if (ctx.tenantId === null) {
        logger.warn('[scoped-client] unscoped access to tenant-scoped table', {
          table,
          actorId: ctx.actorId ?? 'unknown',
        });
      }

      return new Proxy(queryBuilder, {
        get(target, prop, receiver) {
          const original = Reflect.get(target, prop, receiver);
          if (typeof original !== 'function') return original;

          if (prop === 'select' || prop === 'update' || prop === 'delete') {
            return (...args: unknown[]) => {
              // eslint-disable-next-line no-restricted-syntax -- this is the tenant-scope module itself, not a header read
              const result = (original as (...a: unknown[]) => any).apply(target, args);
              return ctx.tenantId === null ? result : result.eq('tenant_id', ctx.tenantId);
            };
          }

          if (prop === 'insert' || prop === 'upsert') {
            return (data: unknown, options?: unknown) => {
              const stamped = Array.isArray(data)
                ? data.map(row => stampTenantId(row as Record<string, unknown>, ctx.tenantId))
                : stampTenantId(data as Record<string, unknown>, ctx.tenantId);
              return (original as (...a: unknown[]) => any).call(target, stamped, options);
            };
          }

          // Everything else (eq, order, limit, single, then, ...) passes
          // through untouched, bound to the real builder.
          return (original as (...a: unknown[]) => any).bind(target);
        },
      });
    },
  };
}
