import type { FulfillmentStatus } from '@/types';
import type { FulfillmentMode } from '@/lib/engine-a/types';
// Canonical helpers live in the domain layer (plan F1) — re-exported here
// so existing staff components keep their import surface.
export { canonicalFulfillmentState, FULFILLMENT_LAYER_STATES, statesForMode } from '@/types';
export type { FulfillmentState } from '@/types';
export type { FulfillmentMode };

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
  /** Human-readable modifier names rendered by the KDS. Derived from
   *  order_items.metadata.selectedModifiers by the backend. */
  modifiers?: string[];
  /** Raw modifier selections carried in order_items.metadata — may be
   *  needed for inventory/customization display. */
  selectedModifiers?: Array<{ groupId: string; optionId: string; quantity: number; name?: string; groupName?: string }>;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  staffName?: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  status: string;
  /** Stage 6 canonical fulfillment state (mode-specific). */
  fulfillmentStatus?: FulfillmentStatus | null;
  /** Phase F1: which fulfillment mode governs this order's states. */
  fulfillmentMode?: FulfillmentMode | null;
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

import { getModeStateConfig, type ModeStateConfig } from '@/lib/engine-a/types';

// ============================================
// Mode-derived order-level flow (F1 resolved)
// ============================================
// The staff surface no longer assumes hospitality-only columns.
// Each fulfillment mode defines its own ordered state machine via
// getModeStateConfig(mode). Components call that function to derive
// columns, labels, actions, and transitions.
//
// `statusFlow` is retained only as a backward-compat fallback for
// legacy code that hasn't yet migrated to mode-derived rendering.
// New code MUST use getModeStateConfig(mode).states.

/** @deprecated Use getModeStateConfig(mode).states instead. */
export const statusFlow = ['pending', 'confirmed', 'queued', 'in_progress', 'ready', 'handed_off', 'completed'] as const;

/** Returns the ordered fulfillment states for a mode.
 *  - Valid mode: returns its state list (including empty for 'none').
 *  - null/undefined: legacy hospitality fallback during migration.
 */
export function statusFlowForMode(mode: FulfillmentMode | null | undefined): readonly string[] {
  const cfg = getModeStateConfig(mode);
  if (cfg) return cfg.states;
  // Legacy recovery: null/unknown mode defaults to hospitality states
  return ['queued', 'in_progress', 'ready', 'handed_off'];
}

// Mirrors backend ITEM_STATUS_FLOW in module-staff.controller.ts — forward-only,
// one step at a time. Kept as a separate flow because order_items isn't a
// registered engine entity and doesn't share the order-level state machine.
export const itemStatusFlow: ItemStatus[] = ['pending', 'preparing', 'ready', 'served'];
