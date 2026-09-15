/**
 * Canonical cross-engine admin transactions endpoint (F11).
 *
 * The unified Orders capability surface needs to list transactions across
 * ALL engine types (instant_transaction, time_exclusive_reservation,
 * shared_capacity_access, ongoing_entitlement) — not just instant modules.
 *
 * This controller queries the canonical `transactions` table — the one
 * source of truth all engines write through — scoped to the caller's
 * property, with engine-agnostic field mapping. The frontend renders
 * canonical fulfillment states via the F1 domain layer; it never infers
 * fulfillment from status (F1 two-layer rule).
 *
 * IMPORTANT: property scope comes ONLY from validatePropertyAccess
 * middleware (req.propertyId), never from client-supplied query params —
 * matching the pattern used by reports.controller.ts.
 */

import { Request, Response } from 'express';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { getCallerTenantId } from '../../../security/tenant-scope.js';

/** Engine types included in the unified view. */
const ENGINE_TYPES = [
  'instant_transaction',
  'time_exclusive_reservation',
  'shared_capacity_access',
  'ongoing_entitlement',
] as const;

export async function getCrossEngineTransactions(req: Request, res: Response) {
  try {
    const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
    if (!propertyId) {
      return res.status(400).json({ success: false, error: 'Property ID context is required' });
    }

    const supabase = getSupabase();

    // Tenant guard: a caller homed to a tenant may only see transactions of
    // modules belonging to tenants they can access. Property scope is the
    // primary boundary (validatePropertyAccess); the tenant check below is
    // defense-in-depth using the JWT-derived tenant id (never a header).
    const callerTenantId = getCallerTenantId(req);

    // Resolve the module ids (and slugs) belonging to this property so the
    // response can carry a module label without a join at render time.
    let modulesQuery = supabase
      .from('modules')
      .select('id, slug, name, engine_type, tenant_id')
      .eq('property_id', propertyId);

    if (callerTenantId !== null) {
      modulesQuery = modulesQuery.eq('tenant_id', callerTenantId);
    }

    const { data: modules, error: modulesError } = await modulesQuery;

    if (modulesError) throw modulesError;

    const moduleIds = (modules || []).map((m: { id: string }) => m.id);
    const moduleMap = new Map<string, { slug: string; name: string; engine_type: string }>();
    for (const m of modules || []) {
      moduleMap.set(m.id, { slug: m.slug, name: m.name, engine_type: m.engine_type });
    }

    if (moduleIds.length === 0) {
      return res.json({ success: true, data: { transactions: [], modules: [] } });
    }

    // Canonical cross-engine query. Selects only fields every engine shares.
    let query = supabase
      .from('transactions')
      .select(
        'id, engine_type, module_id, status, fulfillment_status, amount, currency, customer_id, metadata, created_at, updated_at',
      )
      .in('module_id', moduleIds)
      .in('engine_type', ENGINE_TYPES);

    // Optional filters (all server-side, whitelisted)
    const { engine_type, status, fulfillment_status, limit = '100', offset = '0' } = req.query;
    if (typeof engine_type === 'string' && (ENGINE_TYPES as readonly string[]).includes(engine_type)) {
      query = query.eq('engine_type', engine_type);
    }
    if (typeof status === 'string' && status) {
      query = query.eq('status', status);
    }
    if (typeof fulfillment_status === 'string' && fulfillment_status) {
      query = query.eq('fulfillment_status', fulfillment_status);
    }

    const lim = Math.min(Math.max(parseInt(limit as string, 10) || 100, 1), 500);
    const off = Math.max(parseInt(offset as string, 10) || 0, 0);
    query = query.order('created_at', { ascending: false }).range(off, off + lim - 1);

    const { data: txs, error, count } = await query;
    if (error) throw error;

    // Batch-load customer display names (single query instead of N+1).
    const customerIds = Array.from(
      new Set((txs || []).map((t: any) => t.customer_id).filter(Boolean)),
    );
    const customerMap = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', customerIds);
      for (const u of users || []) {
        customerMap.set(u.id, u.full_name || 'Guest');
      }
    }

    // Engine-agnostic projection. Metadata may hold per-engine display
    // hints (order_number / booking_number / ticket_number) — surfaced as
    // a single `reference` field rather than per-vertical fields.
    const transactions = (txs || []).map((t: any) => {
      const meta = (t.metadata ?? {}) as Record<string, unknown>;
      const module = moduleMap.get(t.module_id);
      const reference =
        (meta.order_number as string) ||
        (meta.booking_number as string) ||
        (meta.ticket_number as string) ||
        t.id;

      return {
        id: t.id,
        engineType: t.engine_type,
        module: module ? { slug: module.slug, name: module.name } : null,
        // Two-layer rule: transaction state + fulfillment state are separate.
        transactionState: t.status,
        fulfillmentStatus: t.fulfillment_status ?? null,
        amount: t.amount,
        currency: t.currency,
        // Historical immutability: prefer the transaction-time snapshot in
        // metadata (part of the commercial snapshot) over the live users
        // row, which can change after the fact (rename, merge).
        customerName:
          (meta.customer_name as string) ||
          (t.customer_id ? customerMap.get(t.customer_id) : undefined) ||
          'Guest',
        reference,
        createdAt: t.created_at,
        updatedAt: t.updated_at,
      };
    });

    res.json({
      success: true,
      data: {
        transactions,
        modules: (modules || []).map((m: any) => ({ slug: m.slug, name: m.name, engineType: m.engine_type })),
        pagination: { limit: lim, offset: off, total: count ?? transactions.length },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching cross-engine transactions:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch transactions' });
  }
}
