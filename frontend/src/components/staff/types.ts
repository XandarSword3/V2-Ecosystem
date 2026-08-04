export type ItemStatus = 'pending' | 'preparing' | 'ready' | 'served';

export interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  specialInstructions?: string;
  // Backend now returns this (module-staff.controller.ts getModuleOrders,
  // order_items.status column, defaults to 'pending' if null).
  status: ItemStatus;
}

export interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  status: string;
  items: OrderItem[];
  totalAmount: number;
  createdAt: string;
  tableNumber?: string;
}

export const statusFlow = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed'];

// Mirrors backend ITEM_STATUS_FLOW in module-staff.controller.ts — forward-only,
// one step at a time. Kept as a separate flow because order_items isn't a
// registered engine entity and doesn't share the order-level state machine.
export const itemStatusFlow: ItemStatus[] = ['pending', 'preparing', 'ready', 'served'];
