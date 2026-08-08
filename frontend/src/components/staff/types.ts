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

// Order-level flow — must match the real instant_transaction engine states
// (instant-transaction.ts). The engine calls this step 'delivered', not
// 'served' — don't rename it back without renaming it in the engine too.
export const statusFlow = ['pending', 'confirmed', 'preparing', 'ready', 'delivered', 'completed'];

// Mirrors backend ITEM_STATUS_FLOW in module-staff.controller.ts — forward-only,
// one step at a time. Kept as a separate flow because order_items isn't a
// registered engine entity and doesn't share the order-level state machine.
export const itemStatusFlow: ItemStatus[] = ['pending', 'preparing', 'ready', 'served'];
