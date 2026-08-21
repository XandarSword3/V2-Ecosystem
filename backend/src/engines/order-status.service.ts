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
import { ResourceConsumptionService } from '../modules/resource/index.js';
import { hospitalityResourceResolver } from '../adapters/hospitality/resources.js';
import type { FulfillmentMode } from './types.js';
import { reverseDiscounts } from './discount-reversal.js';
import { emitToUnit, emitToOrder } from '../socket/index.js';
import { logger } from '../utils/logger.js';

// The generic resource service is wired with the hospitality BOM resolver at
// this call site — the adapter owns the menu_item_ingredients vocabulary; the
// service only ever sees typed generic requirements. This file is the
// hospitality order-status orchestrator, so the adapter dependency belongs
// HERE, not in the generic core (plan Phase 5 boundary).
const resourceConsumption = new ResourceConsumptionService(hospitalityResourceResolver);

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
  | { ok: false; status: 400 | 404 | 409 | 500; error: string };

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
  //
  // FAIL-CLOSED read: a fulfillment read error aborts the transition (500)
  // rather than falling back to transactions.status. This function WRITES
  // state; a write must never be based on a stale/meaningless read. With the
  // confirm trigger, a confirmed order always has a row; null here means the
  // row genuinely does not exist.
  let fulfillment: Awaited<ReturnType<typeof fulfillmentService.getForTransaction>>;
  try {
    fulfillment = await fulfillmentService.getForTransaction(supabase, orderId);
  } catch (readErr) {
    return {
      ok: false,
      status: 500,
      error: readErr instanceof Error ? readErr.message : 'Failed to read fulfillment state',
    };
  }
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

  // The fulfillment MODE is the runtime authority for the resource layer
  // too. Pre-trigger (confirm not yet written) the row does not exist, so
  // the mode comes from the immutable snapshot POST /orders stored in
  // transactions.metadata — the exact choice the customer made at checkout.
  const orderMetadata = (current.metadata ?? {}) as Record<string, unknown>;
  const selectedMode =
    (fulfillment?.mode as FulfillmentMode | undefined) ??
    (orderMetadata.fulfillment_mode as FulfillmentMode | undefined);
  const isConfirmation = transition.layer === 'transaction' && transition.targetState === 'confirmed';

  // ── No-window invariant (plan Phase 5) ──────────────────────────────────
  // The customer must NEVER be told "confirmed" while mandatory resources
  // are unavailable. Resource allocation therefore runs PRE-FLIGHT, before
  // the confirm write: if it fails, the request fails and the order stays
  // pending — the confirm UPDATE (and its fulfillment trigger) never runs.
  // Post-commit side effects (consume on handoff, release on cancel) stay
  // best-effort below; allocation is the one move that gates confirmation.
  if (isConfirmation) {
    const allocation = await resourceConsumption.allocateForConfirmation(supabase, {
      transactionId: orderId,
      engineType,
      mode: selectedMode,
      propertyId: String(current.property_id ?? ''),
      tenantId: tenantId ?? String(current.tenant_id),
      context: { orderId, moduleId },
    });
    if (!allocation.ok) {
      logger.error('[OrderStatus] Refusing to confirm — resource allocation failed', {
        orderId,
        mode: selectedMode,
        reason: allocation.reason,
        error: allocation.error,
      });
      return {
        ok: false,
        status: allocation.reason === 'unavailable' ? 409 : 500,
        error: allocation.error,
      };
    }
  }

  // Stage 6: the canonical fulfillment row is created ATOMICALLY with the
  // confirmation itself — the ensure_fulfillment_on_confirm DB trigger fires
  // on the transactions.status UPDATE to 'confirmed' and inserts the row in
  // the same statement. If the trigger fails, the confirm UPDATE rolls back
  // and the order stays pending: economic confirmation and fulfillment
  // initialization can never diverge. No "confirm first, self-heal later"
  // path exists here.

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
    // The confirm trigger created the row atomically, so a fulfillment move
    // on an order with NO row is a contract violation (pre-trigger data or a
    // broken trigger) — fail closed rather than silently self-healing. A
    // write must never proceed from an assumption.
    if (!fulfillment) {
      return {
        ok: false,
        status: 500,
        error: 'Fulfillment row missing for a required-fulfillment order — confirmation did not initialize fulfillment (check the ensure_fulfillment_on_confirm trigger)',
      };
    }
    let fulfillmentResult;
    try {
      fulfillmentResult = await fulfillmentService.transition(supabase, {
        transactionId: orderId,
        action,
        actor,
        actorId: userId ?? null,
        expectedFrom: fulfillment.status,
        context: { orderId, moduleId },
      });
    } catch (transitionErr) {
      return {
        ok: false,
        status: 500,
        error: transitionErr instanceof Error ? transitionErr.message : 'Fulfillment transition failed',
      };
    }
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
    // Stage 6: NO transitional fulfillment_state mirror is written anymore.
    // The fulfillments table is the canonical fulfillment layer; every
    // consumer reads it directly (the join in getModuleOrders / the order
    // read endpoints). transactions.metadata carries only transaction-
    // layer and settlement facts.
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

  if (updateError) {
    // Compensation for the pre-flight path: the allocation succeeded but
    // the confirm write failed — release the just-allocated rows so the
    // benign orphan (resources reserved, transaction still pending) does
    // not linger. Best-effort: release is idempotent; the rows are inert
    // for a non-confirmed transaction either way.
    if (isConfirmation) {
      try {
        await resourceConsumption.release(supabase, {
          transactionId: orderId,
          engineType,
          mode: selectedMode,
          action: 'cancel',
          actor,
          actorId: userId ?? null,
          currentState: 'pending',
          context: { orderId, moduleId },
        });
      } catch (releaseErr) {
        logger.error(
          '[OrderStatus] Failed to release pre-flight allocation after confirm write failed',
          releaseErr instanceof Error ? releaseErr.message : String(releaseErr),
        );
      }
    }
    return { ok: false, status: 500, error: updateError.message };
  }

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

  // ── Resource lifecycle (plan Phase 5) ────────────────────────────────────
  // The order-status choke point drives the generic resource layer from the
  // canonical move facts: allocate on economic confirmation, consume at the
  // selected mode's handoff condition, release on cancellation. The row's
  // fulfillment MODE is the authority — digital_delivery resolves to its
  // per-mode 'none' model (no inventory lifecycle) while hospitality modes
  // allocate/consume via the BOM adapter.
  //
  // Non-fatal by design, same boundary as fiscal issuance below: the state
  // move has already persisted and must not be rolled back by a side-effect
  // hiccup. The RPCs are idempotent (20260821210000 — events record only
  // rows actually transitioned), and the resolver validates fail-closed
  // before any write, so a failed move is retryable and never corrupts state.
  // Confirmation allocated pre-flight above; the post-update lifecycle
  // driver handles ONLY the compensating moves (release on cancel, consume
  // at the mode's handoff) — never a second allocation.
  if (!isConfirmation) {
    try {
      const lifecycle = await resourceConsumption.handleLifecycleMove(supabase, {
        transactionId: orderId,
        engineType,
        mode: selectedMode,
        action,
        actor,
        actorId: userId ?? null,
        currentState,
        targetState: transition.targetState ?? persistedState,
        layer: transition.layer ?? (isCancelling ? 'transaction' : 'fulfillment'),
        propertyId: String(order.property_id ?? ''),
        tenantId: tenantId ?? String(order.tenant_id),
        context: { orderId, moduleId },
      });
      if (!lifecycle.ok) {
        logger.error('[OrderStatus] Resource lifecycle move failed', {
          orderId,
          op: lifecycle.op,
          error: lifecycle.error,
        });
      }
    } catch (lifecycleErr) {
      logger.error(
        '[OrderStatus] Resource lifecycle move threw',
        lifecycleErr instanceof Error ? lifecycleErr.message : String(lifecycleErr),
      );
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
      // The in-scope transition result IS the canonical state; there is no
      // transitional metadata mirror anymore.
      fulfillmentStatus: transition.canonicalState ?? null,
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
