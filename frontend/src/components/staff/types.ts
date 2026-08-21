import type { FulfillmentState, FulfillmentStatus } from '@/types';

export type ItemStatus = 'pending' | 'preparing' | 'ready' | 'served';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  // FIX: backend (getModuleOrders) has always returned this per item —
  // it just wasn't declared here, so callers silently dropped it instead
  // of a type error catching the gap.
  unitPrice: number;
  specialInstructions?: string;
  // Backend now returns this (module-staff.controller.ts getModuleOrders,
  // order_items.status column, defaults to 'pending' if null).
  status: ItemStatus;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  staffName?: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  status: string;
  /** Stage 6 canonical fulfillment state (queued/in_progress/ready/handed_off). */
  fulfillmentStatus?: FulfillmentStatus | null;
  items: OrderItem[];
  totalAmount: number;
  createdAt: string;
  tableNumber?: string;
  // Added alongside the DispatchBoard work — resolved server-side from
  // transactions.service_location_id against service_locations, falling
  // back to metadata.table_number for orders with no location tied to them
  // (see getModuleOrders). null/undefined means "no destination on file",
  // not "takeaway" specifically — the board that groups on this should
  // bucket that case explicitly rather than assume.
  destination?: string | null;
  serviceLocationId?: string | null;
}

// Order-level flow — canonical fulfillment states (Stage 6). The engine's
// fulfillment machine owns queued → in_progress → ready → handed_off; the
// transaction layer owns pending/confirmed/completed/cancelled. The KDS
// columns key off the CANONICAL fulfillment state, never the legacy
// composites (preparing/delivered) that pre-Stage-6 rows carried.
export const statusFlow = ['pending', 'confirmed', 'queued', 'in_progress', 'ready', 'handed_off', 'completed'] as const;
export const FULFILLMENT_LAYER_STATES: readonly FulfillmentState[] = ['queued', 'in_progress', 'ready', 'handed_off'];

/**
 * Resolve the canonical fulfillment state for an order. Stage 6: the backend
 * returns fulfillmentStatus (canonical). For historical rows / socket events
 * that may still carry legacy composites on status, map them here.
 */
export function canonicalFulfillmentState(order: { fulfillmentStatus?: string | null; status?: string }): string | null {
  if (order.fulfillmentStatus) return order.fulfillmentStatus;
  switch (order.status) {
    case 'preparing': return 'in_progress';
    case 'delivered':
    case 'served':    return 'handed_off';
    case 'ready':     return 'ready';
    default:          return order.status ?? null;
  }
}

// Mirrors backend ITEM_STATUS_FLOW in module-staff.controller.ts — forward-only,
// one step at a time. Kept as a separate flow because order_items isn't a
// registered engine entity and doesn't share the order-level state machine.
export const itemStatusFlow: ItemStatus[] = ['pending', 'preparing', 'ready', 'served'];
