/**
 * Unified fulfillment work queue endpoint (F11 Fulfillment capability).
 *
 * One cross-engine operational surface: rows from the canonical `fulfillments`
 * table joined to their transactions, for ALL engine types of the property.
 * Each work item carries:
 *   - the canonical fulfillment state + mode (never derived from status)
 *   - the transaction-layer state alongside it (F1 two-layer rule)
 *   - available staff actions computed by the mode-bound state machine via
 *     engineService.getAvailableActions — the frontend renders buttons from
 *     THIS list and never hardcodes vertical state names (plan rule 2)
 *
 * Security chain mirrors the other F11 capability endpoints:
 *   authenticate → authorizeManager → validatePropertyAccess (router.use)
 *   → tenant defense-in-depth here (JWT tenant id only).
 */

import { Request, Response } from 'express';
import { getSupabase } from '../../../database/connection.js';
import { logger } from '../../../utils/logger.js';
import { getCallerTenantId } from '../../../security/tenant-scope.js';
import { getEngineService } from '../../../engines/engine-service.js';
import { getFulfillmentService } from '../../fulfillment/index.js';

const QUEUE_TERMINAL_STATES = ['completed', 'cancelled', 'handed_off', 'delivered', 'collected', 'accessed'];

export async function getFulfillmentQueue(req: Request, res: Response) {
  try {
    const propertyId = (req as any).propertyId || req.headers?.['x-property-id'] as string;
    if (!propertyId) {
      return res.status(400).json({ success: false, error: 'Property ID context is required' });
    }

    const supabase = getSupabase();
    const callerTenantId = getCallerTenantId(req);

    // Scope modules exactly like the other F11 endpoints: property (primary)
    // + tenant (defense-in-depth, JWT-derived only).
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
      return res.json({ success: true, data: { items: [], modules: [] } });
    }

    // Active (non-terminal) transaction states for the queue — completed and
    // cancelled work is not "work". The engine's transaction layer defines
    // these; they are the same four across every Engine A engine.
    const { status, mode, module: moduleSlug, limit = '100', offset = '0' } = req.query;
    const engineService = getEngineService();

    // Resolve fulfillment rows joined to their transactions. PostgREST
    // embedded join: fulfillments has transaction_id FK to transactions.
    let queueQuery = supabase
      .from('fulfillments')
      .select(`
        id, transaction_id, engine_type, status, mode,
        destination_type, destination_ref, tracking_ref,
        queued_at, in_progress_at, ready_at, handed_off_at, completed_at, cancelled_at, created_at, updated_at,
        transactions!inner ( id, module_id, status, amount, currency, customer_id, metadata, created_at )
      `)
      .in('transactions.module_id', moduleIds);

    if (typeof mode === 'string' && mode) {
      queueQuery = queueQuery.eq('mode', mode);
    }
    if (typeof status === 'string' && status) {
      queueQuery = queueQuery.eq('status', status);
    }

    const lim = Math.min(Math.max(parseInt(limit as string, 10) || 100, 1), 500);
    const off = Math.max(parseInt(offset as string, 10) || 0, 0);
    queueQuery = queueQuery.order('queued_at', { ascending: true, nullsFirst: false }).range(off, off + lim - 1);

    const { data: rows, error } = await queueQuery;
    if (error) throw error;

    // Module slug filter applied in-memory (slug → id resolution).
    const filteredRows = (rows || []).filter((r: any) => {
      if (moduleSlug && typeof moduleSlug === 'string') {
        const mod = moduleMap.get(r.transactions?.module_id);
        if (!mod || mod.slug !== moduleSlug) return false;
      }
      return true;
    });

    // Batch-load customer display names.
    const customerIds = Array.from(
      new Set(filteredRows.map((r: any) => r.transactions?.customer_id).filter(Boolean)),
    );
    const customerMap = new Map<string, string>();
    if (customerIds.length > 0) {
      const { data: users } = await supabase
        .from('users')
        .select('id, full_name')
        .in('id', customerIds);
      for (const u of users || []) customerMap.set(u.id, u.full_name || 'Guest');
    }

    // Project each row with its engine-computed available actions.
    const items = filteredRows.map((row: any) => {
      const tx = row.transactions ?? {};
      const meta = (tx.metadata ?? {}) as Record<string, unknown>;
      const mod = moduleMap.get(tx.module_id);
      const currentState = row.status;
      const fulfillmentMode = row.mode ?? undefined;

      // Engine-computed actions for staff on THIS mode's machine. The frontend
      // renders whatever the engine returns — no hardcoded vertical states.
      let availableActions: Array<{ action: string; targetState: string }> = [];
      try {
        availableActions = engineService.getAvailableActions(
          row.engine_type,
          currentState,
          'staff',
          fulfillmentMode as never,
        );
      } catch (actionErr) {
        logger.warn('Failed to compute available fulfillment actions', {
          transactionId: row.transaction_id,
          error: actionErr instanceof Error ? actionErr.message : String(actionErr),
        });
      }

      return {
        id: row.id,
        transactionId: row.transaction_id,
        engineType: row.engine_type,
        module: mod ? { slug: mod.slug, name: mod.name } : null,
        // Two-layer rule: both states exposed separately.
        fulfillmentStatus: currentState,
        fulfillmentMode: fulfillmentMode ?? null,
        transactionStatus: tx.status ?? null,
        // Mode-bound machine actions for staff.
        availableActions,
        destinationType: row.destination_type,
        destinationRef: row.destination_ref,
        trackingRef: row.tracking_ref,
        reference:
          (meta.order_number as string) ||
          (meta.booking_number as string) ||
          (meta.ticket_number as string) ||
          row.transaction_id,
        customerName:
          (meta.customer_name as string) ||
          (tx.customer_id ? customerMap.get(tx.customer_id) : undefined) ||
          'Guest',
        amount: tx.amount,
        currency: tx.currency,
        queuedAt: row.queued_at,
        inProgressAt: row.in_progress_at,
        readyAt: row.ready_at,
        handedOffAt: row.handed_off_at,
        completedAt: row.completed_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      };
    });

    res.json({
      success: true,
      data: {
        items,
        modules: (modules || []).map((m: any) => ({ slug: m.slug, name: m.name, engineType: m.engine_type })),
        pagination: { limit: lim, offset: off, total: items.length },
      },
    });
  } catch (error: any) {
    logger.error('Error fetching fulfillment queue:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch fulfillment queue' });
  }
}
