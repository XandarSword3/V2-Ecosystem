/**
 * Order status transitions — the one place that changes an
 * instant_transaction order's status, instead of two.
 *
 * Previously module-staff.controller.ts's updateModuleOrderStatus (what the
 * KDS calls online) and dynamic-module.router.ts's PATCH /orders/:id/status
 * (what offline-sync replay calls, and the only one with real module_id
 * scoping + discount reversal) were separate implementations of the same
 * responsibility. Consolidated here — both routes now just resolve their own
 * module/auth context and call changeInstantTransactionOrderStatus.
 *
 * actorForUser / resolveAction were moved here from dynamic-module.router.ts
 * unchanged. They're generic (used for bookings, tickets, and shared-capacity
 * status changes too, not just orders) — this is just the first shared home
 * for them, not an order-specific concept.
 */
import type { Request } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getEngineService } from './engine-service.js';
import { TEMPLATE_TO_ENGINE } from './types.js';
import { getFulfillmentService } from '../modules/fulfillment/index.js';
import { reverseDiscounts } from './discount-reversal.js';
import { emitToUnit, emitToOrder } from '../socket/index.js';
import { logger } from '../utils/logger.js';

export type Actor = 'system' | 'staff' | 'customer' | 'admin';

export function actorForUser(req: Request): Actor {
  const roles = req.user?.roles ?? [];
  if (roles.includes('super_admin') || roles.includes('admin') || roles.includes('manager')) {
    return 'admin';
  }
  if (roles.some((role) => role.includes('staff'))) {
    return 'staff';
  }
  return 'customer';
}

/**
 * Resolve the action name for a target state or legacy alias.
 * Clients send target state names (e.g. 'confirmed') or legacy aliases
 * (e.g. 'active', 'used') — map them to the real action name the
 * state machine expects (e.g. 'confirm', 'validate_entry', 'record_exit').
 */
export function resolveAction(
  templateType: string,
  currentState: string,
  targetStateOrAction: string,
  actor: Actor,
): string {
  const engineService = getEngineService();
  const available = engineService.getAvailableActions(templateType, currentState, actor);

  // 1. Direct action name match (already correct)
  if (available.find((a) => a.action === targetStateOrAction)) return targetStateOrAction;

  // 2. Target state name match (client sent destination state, not action)
  const stateMatch = available.find((a) => a.targetState === targetStateOrAction);
  if (stateMatch) return stateMatch.action;

  // 3. Legacy action name aliases (old API surface → new action names). This
  // includes the pre-Stage-6 fulfillment composite statuses (preparing /
  // delivered), which the KDS/frontend may still send as target states. The
  // canonical actions come from the fulfillment machine.
  //
  // Each alias maps to CANDIDATE actions; the first one that exists on THIS
  // engine wins. This keeps engine-specific legacy names working — e.g.
  // 'complete' means the 'complete' action on instant_transaction (its
  // fulfillment machine's completion) but 'record_exit' on
  // shared_capacity_access, whose machine names its own exit differently.
  const ACTION_ALIASES: Record<string, string[]> = {
    // instant_transaction — legacy fulfillment composites → canonical actions
    'preparing':       ['start_preparation'],
    'delivered':       ['deliver'],
    'served':          ['deliver'],
    'ready':           ['mark_ready'],
    'complete':        ['complete', 'record_exit'],
    'completed':       ['complete', 'record_exit'],
    'cancel':          ['cancel'],
    'cancelled':       ['cancel'],
    'confirm':         ['confirm'],
    'confirmed':       ['confirm'],
    // shared_capacity_access
    'validate':        ['validate_entry'],
    'active':          ['check_in'],
    'used':            ['check_out'],
    'check_in':        ['check_in'],
    'check_out':       ['check_out'],
    'no_show':         ['mark_no_show'],
  };
  const aliasedAction = (ACTION_ALIASES[targetStateOrAction] ?? [])
    .find((a) => available.some((av) => av.action === a));
  if (aliasedAction) return aliasedAction;

  // Fall through: return as-is (will fail gracefully in transitionState)
  return targetStateOrAction;
}

export interface OrderStatusChangeParams {
  orderId: string;
  moduleId: string;
  moduleSlug: string;
  // Raw value from modules.engine_type — may still be a legacy template name
  // (e.g. 'menu_service') on modules that predate the engine_type migration.
  moduleEngineTypeRaw: string;
  requestedStatus: string;
  actor: Actor;
  userId?: string;
  tenantId?: string | null;
}

export type OrderStatusChangeResult =
  | { ok: true; status: 200; order: Record<string, unknown> }
  | { ok: false; status: 400 | 404 | 500; error: string };

export async function changeInstantTransactionOrderStatus(
  supabase: SupabaseClient,
  params: OrderStatusChangeParams,
): Promise<OrderStatusChangeResult> {
  const { orderId, moduleId, moduleSlug, moduleEngineTypeRaw, requestedStatus, actor, userId, tenantId } = params;
  const engineService = getEngineService();
  const fulfillmentService = getFulfillmentService();
  const engineType = TEMPLATE_TO_ENGINE[moduleEngineTypeRaw] || 'instant_transaction';

  // Scoped to both order AND module in one query — a staff member (or a
  // replayed offline action) can't touch a different tenant's order just by
  // supplying its id. This was previously missing on the KDS endpoint.
  const { data: current, error: fetchError } = await supabase
    .from('transactions')
    .select('id, status, customer_id, metadata, tenant_id, property_id')
    .eq('engine_type', 'instant_transaction')
    .eq('id', orderId)
    .eq('module_id', moduleId)
    .maybeSingle();

  if (fetchError) return { ok: false, status: 500, error: fetchError.message };
  if (!current) return { ok: false, status: 404, error: 'Order not found for this module' };

  // Stage 6: the canonical fulfillment state lives in the fulfillments table.
  // Determine which layer this order is on — a transaction-layer state means
  // the move is a transaction move; a fulfillment row means fulfillment moves.
  let fulfillment = await fulfillmentService.getForTransaction(supabase, orderId);
  const currentState = fulfillment?.status ?? current.status;

  const action = resolveAction(engineType, currentState, requestedStatus, actor);
  const transition = await engineService.transitionState(engineType, currentState, action, actor, {
    orderId,
    moduleId,
    staffId: userId,
  });

  if (!transition.allowed) {
    return {
      ok: false,
      status: 400,
      error: transition.error || `Cannot transition order from '${currentState}' to '${requestedStatus}'`,
    };
  }

  // Stage 6: create the canonical fulfillment row the moment the transaction
  // is confirmed (idempotent — the RPC is ON CONFLICT DO NOTHING). This is
  // what gives the fulfillment layer its own persistence: from here on,
  // transactions.status only ever carries transaction-layer meaning. Non-fatal
  // here because the fulfillment branch below self-heals by ensuring again.
  if (transition.targetState === 'confirmed') {
    const ensured = await fulfillmentService.ensure(supabase, {
      transactionId: orderId,
      engineType,
      moduleId,
      propertyId: current.property_id ?? null,
      tenantId: current.tenant_id ?? null,
    });
    if (!ensured.ok) {
      logger.warn('[OrderStatus] ensure_fulfillment failed after confirm', { orderId, error: ensured.error });
    } else {
      fulfillment = await fulfillmentService.getForTransaction(supabase, orderId);
    }
  }

  const currentMetadata = (current.metadata ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const isCancelling = transition.targetState === 'cancelled';
  // Guard against reversing twice — a refund via payment.controller.ts's
  // processRefundById can also reach this order and reverses the same way;
  // whichever happens first sets discountsReversedAt.
  const alreadyReversed = Boolean(currentMetadata.discountsReversedAt);

  // ── Stage 6 persistence ──────────────────────────────────────────────────
  // Fulfillment-layer moves write the canonical state to the fulfillments
  // table (the fulfillment machine's states ARE the canonical states).
  // Transaction-layer moves (confirm / cancel from the transaction layer)
  // write transactions.status. transactions.status never carries fulfillment
  // meaning anymore.
  let persistedState = transition.targetState;
  if (transition.layer === 'fulfillment' && transition.canonicalState) {
    // Self-heal: pre-Stage-6 rows (or orders confirmed before the ensure
    // above landed) may lack a fulfillment row. Create it, then transition.
    if (!fulfillment) {
      const ensured = await fulfillmentService.ensure(supabase, {
        transactionId: orderId,
        engineType,
        moduleId,
        propertyId: current.property_id ?? null,
        tenantId: current.tenant_id ?? null,
      });
      if (!ensured.ok) {
        return { ok: false, status: 500, error: ensured.error ?? 'Failed to create fulfillment row' };
      }
      fulfillment = await fulfillmentService.getForTransaction(supabase, orderId);
      if (!fulfillment) {
        return { ok: false, status: 500, error: 'Fulfillment row could not be created' };
      }
    }
    const fulfillmentResult = await fulfillmentService.transition(supabase, {
      transactionId: orderId,
      action,
      actor,
      actorId: userId ?? null,
      expectedFrom: fulfillment.status,
      context: { orderId, moduleId },
    });
    if (!fulfillmentResult.ok) {
      return { ok: false, status: 500, error: fulfillmentResult.error ?? 'Fulfillment transition failed' };
    }
    persistedState = fulfillmentResult.canonicalState ?? transition.targetState;
  }

  // Keyed off the canonical resulting state — resolveAction may have mapped
  // an alias, and fulfillment states are canonical now.
  const timestampFields: Record<string, unknown> = {
    ...(transition.canonicalState === 'in_progress' ? { estimated_ready_time: new Date(Date.now() + 20 * 60000).toISOString() } : {}),
    ...(transition.canonicalState === 'ready' ? { actual_ready_time: now } : {}),
    ...(transition.canonicalState === 'handed_off' ? { served_at: now } : {}),
    ...(transition.canonicalState === 'completed' || transition.targetState === 'completed' ? { completed_at: now } : {}),
    ...(isCancelling ? { cancelled_at: now } : {}),
    ...(isCancelling && !alreadyReversed ? { discountsReversedAt: now } : {}),
    // Canonical FULFILLMENT-layer state for consumers that haven't migrated
    // to reading the fulfillments table yet (Stage 6 transitional).
    ...(transition.layer === 'fulfillment' && transition.canonicalState
      ? { fulfillment_state: transition.canonicalState }
      : {}),
  };

  // Transaction-layer status: only update it for transaction-layer moves or
  // cross-layer outcomes (complete/cancel). Fulfillment moves leave it at the
  // confirmed/completed/cancelled transaction state.
  const txStatusUpdate = transition.layer === 'transaction' || transition.targetState === 'completed' || isCancelling
    ? { status: transition.targetState === 'completed' || isCancelling ? transition.targetState : persistedState }
    : {};

  const { data: order, error: updateError } = await supabase
    .from('transactions')
    .update({
      ...txStatusUpdate,
      updated_at: now,
      metadata: { ...currentMetadata, ...timestampFields },
    })
    .eq('id', orderId)
    .eq('module_id', moduleId)
    .select('*')
    .single();

  if (updateError) return { ok: false, status: 500, error: updateError.message };

  // Give back whatever coupon/gift card this order consumed at creation.
  // Previously only the dynamic-module.router.ts path did this — cancelling
  // through the KDS endpoint never touched coupon usage counts or gift card
  // balances at all.
  if (isCancelling && !alreadyReversed) {
    const discounts = Array.isArray((currentMetadata as { discounts?: unknown }).discounts)
      ? (currentMetadata as { discounts: any[] }).discounts
      : [];
    if (discounts.length > 0) {
      await reverseDiscounts(supabase, discounts, {
        userId: (current as { customer_id?: string }).customer_id ?? undefined,
        orderId: current.id,
      });
    }
  }

  // Real-time notify the KDS. Previously only the staff-controller path did
  // this — an update replayed through dynamic-module.router.ts (e.g. after
  // coming back online) would land in the DB but no open KDS screen would
  // see it until its next manual refresh.
  try {
    const orderMeta = (order.metadata ?? {}) as Record<string, unknown>;
    const payload = {
      id: order.id,
      status: order.status,
      // Canonical fulfillment state (Stage 6) — the KDS consumes this.
      // Prefer the in-scope transition result; fall back to the transitional
      // metadata mirror written in the same update above.
      fulfillmentStatus: transition.canonicalState ?? orderMeta.fulfillment_state ?? null,
      tableNumber: orderMeta.table_number ?? orderMeta.table_id ?? null,
    };
    emitToUnit(tenantId || 'default', moduleSlug, 'order:status', payload);
    emitToUnit(tenantId || 'default', moduleId, 'order:status', payload);
    emitToOrder(order.id, 'order:status', payload);
  } catch (socketErr: any) {
    logger.warn('Failed to emit order:status', socketErr.message);
  }

  // Audit log (non-critical, don't fail the request if this errors).
  try {
    await supabase.from('activity_logs').insert({
      user_id: userId,
      action: 'order_status_update',
      resource_type: 'order',
      resource_id: orderId,
      details: { newStatus: transition.targetState, moduleSlug },
      tenant_id: tenantId,
    });
  } catch (logError: any) {
    logger.warn('Failed to log order status activity:', logError.message);
  }

  // Fiscal document issuance (DOMAIN.md G1) — once the transaction is
  // economically committed, the fiscal engine must produce its document from
  // the immutable snapshot. Non-fatal by design: a fiscal hiccup must never
  // block the order transition; the fiscal API and the payment webhook are
  // the explicit retry paths. Dynamic import keeps the engine layer free of a
  // static dependency on the fiscal module.
  // "Economically committed" = transaction confirmed/completed OR fulfillment
  // in progress (canonical fulfillment states in_progress/ready/handed_off).
  const FISCALLY_COMMITTED = new Set(['confirmed', 'in_progress', 'ready', 'handed_off', 'completed']);
  if (FISCALLY_COMMITTED.has(persistedState) || FISCALLY_COMMITTED.has(transition.canonicalState ?? '')) {
    try {
      const { fiscalDocumentService } = await import('../modules/fiscal/fiscal-document.service.js');
      await fiscalDocumentService.issueForTransaction(orderId, {
        tenantId: tenantId ?? String(order.tenant_id),
        propertyId: String(order.property_id),
        actorId: userId ?? null,
      });
      logger.info('[OrderStatus] Fiscal document issued after status transition', {
        orderId,
        state: transition.canonicalState ?? persistedState,
      });
    } catch (fiscalErr: any) {
      logger.warn('[OrderStatus] Fiscal document issuance deferred (retry via fiscal API)', {
        orderId,
        error: fiscalErr?.message ?? String(fiscalErr),
      });
    }
  }

  return { ok: true, status: 200, order };
}
