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
import { reverseDiscounts } from './discount-reversal.js';
import { emitToUnit } from '../socket/index.js';
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

  // 3. Legacy action name aliases (old API surface → new action names)
  const ACTION_ALIASES: Record<string, string> = {
    // shared_capacity_access
    'validate':        'validate_entry',
    'complete':        'record_exit',
    // time_exclusive_reservation (old status names used as actions)
    'active':          'check_in',
    'used':            'check_out',
    'check_in':        'check_in',
    'check_out':       'check_out',
    'cancel':          'cancel',
    'cancelled':       'cancel',
    'confirm':         'confirm',
    'confirmed':       'confirm',
    'no_show':         'mark_no_show',
  };
  const aliasedAction = ACTION_ALIASES[targetStateOrAction];
  if (aliasedAction && available.find((a) => a.action === aliasedAction)) return aliasedAction;

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
  const engineType = TEMPLATE_TO_ENGINE[moduleEngineTypeRaw] || 'instant_transaction';

  // Scoped to both order AND module in one query — a staff member (or a
  // replayed offline action) can't touch a different tenant's order just by
  // supplying its id. This was previously missing on the KDS endpoint.
  const { data: current, error: fetchError } = await supabase
    .from('transactions')
    .select('id, status, customer_id, metadata')
    .eq('engine_type', 'instant_transaction')
    .eq('id', orderId)
    .eq('module_id', moduleId)
    .maybeSingle();

  if (fetchError) return { ok: false, status: 500, error: fetchError.message };
  if (!current) return { ok: false, status: 404, error: 'Order not found for this module' };

  const action = resolveAction(engineType, current.status, requestedStatus, actor);
  const transition = await engineService.transitionState(engineType, current.status, action, actor, {
    orderId,
    moduleId,
    staffId: userId,
  });

  if (!transition.allowed) {
    return {
      ok: false,
      status: 400,
      error: transition.error || `Cannot transition order from '${current.status}' to '${requestedStatus}'`,
    };
  }

  const currentMetadata = (current.metadata ?? {}) as Record<string, unknown>;
  const now = new Date().toISOString();
  const isCancelling = transition.targetState === 'cancelled';
  // Guard against reversing twice — a refund via payment.controller.ts's
  // processRefundById can also reach this order and reverses the same way;
  // whichever happens first sets discountsReversedAt.
  const alreadyReversed = Boolean(currentMetadata.discountsReversedAt);

  // Keyed off transition.targetState (the engine's actual resulting state),
  // not the raw requestedStatus — resolveAction may have mapped an alias.
  const timestampFields: Record<string, unknown> = {
    ...(transition.targetState === 'preparing' ? { estimated_ready_time: new Date(Date.now() + 20 * 60000).toISOString() } : {}),
    ...(transition.targetState === 'ready' ? { actual_ready_time: now } : {}),
    ...(transition.targetState === 'delivered' ? { served_at: now } : {}),
    ...(transition.targetState === 'completed' ? { completed_at: now } : {}),
    ...(isCancelling ? { cancelled_at: now } : {}),
    ...(isCancelling && !alreadyReversed ? { discountsReversedAt: now } : {}),
  };

  const { data: order, error: updateError } = await supabase
    .from('transactions')
    .update({
      status: transition.targetState,
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
      tableNumber: orderMeta.table_number ?? orderMeta.table_id ?? null,
    };
    emitToUnit(tenantId || 'default', moduleSlug, 'order:status', payload);
    emitToUnit(tenantId || 'default', moduleId, 'order:status', payload);
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

  return { ok: true, status: 200, order };
}
