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

// ──────────────────────────────────────────────────────────────────────────
// ⚠  F1 OPEN BLOCKER: Hospitality-only status flow
// ──────────────────────────────────────────────────────────────────────────
// This statusFlow is hardcoded to the HOSPITALITY fulfillment subset:
//   queued → in_progress → ready → handed_off
//
// It does NOT represent Engine A's full FulfillmentState union:
//   Hospitality:  queued → in_progress → ready → handed_off
//   Digital:      provisioning → provisioned → delivered
//   Shipment:     allocated → picking → packed → shipped → in_transit → delivered
//   Service:      received → working → ready → collected
//
// The frontend MUST select the correct flow based on the order's
// fulfillmentMode, using statesForMode(mode) from @/lib/engine-a/types.
//
// Until this is resolved:
//   - KitchenView.BOARD_COLUMNS is hospitality-only
//   - StaffPOSTemplate renders hospitality-only column layout
//   - No component derives columns/actions from fulfillmentMode
//
// This is a Phase F1 blocker. Phase 8 frontend is NOT complete until
// the staff operating surface renders mode-specific states/actions.
// ──────────────────────────────────────────────────────────────────────────
//
// Order-level flow — canonical fulfillment states (Stage 6). The engine's
// fulfillment machine owns queued → in_progress → ready → handed_off; the
// transaction layer owns pending/confirmed/completed/cancelled. The KDS
// columns key off the CANONICAL fulfillment state, never the legacy
// composites (preparing/delivered) that pre-Stage-6 rows carried.
export const statusFlow = ['pending', 'confirmed', 'queued', 'in_progress', 'ready', 'handed_off', 'completed'] as const;

// Mirrors backend ITEM_STATUS_FLOW in module-staff.controller.ts — forward-only,
// one step at a time. Kept as a separate flow because order_items isn't a
// registered engine entity and doesn't share the order-level state machine.
export const itemStatusFlow: ItemStatus[] = ['pending', 'preparing', 'ready', 'served'];
