'use client';

import { useEffect, useState, type Dispatch, type SetStateAction } from 'react';
import { useSocket } from '@/lib/socket';
import { formatCurrency, formatTime } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import {
  UtensilsCrossed,
  Clock,
  ChefHat,
  RefreshCw,
  XCircle,
  Check,
  ChevronRight,
  Plus,
  Minus,
  ShoppingCart,
} from 'lucide-react';
import { Order, OrderItem, ItemStatus, itemStatusFlow, canonicalFulfillmentState, FULFILLMENT_LAYER_STATES } from './types';
import type { FulfillmentState, FulfillmentStatus, FulfillmentMode, ModeStateConfig } from '@/types';
import { getModeStateConfig, resolveColumnKey, isFulfillmentMode } from '@/lib/engine-a/types';

import { isOnline, ordersStore, cacheManager } from '@/lib/offline/offline-storage';
import { createOfflineOrderStatusUpdate, createOfflineOrder } from '@/lib/offline/offline-sync';
import { DataFreshnessFooter } from '@/components/offline/DataFreshnessFooter';

export interface KitchenViewProps {
  slug: string;
  moduleName: string;
  moduleId: string;
  // Modules with require_reservation=true get order creation through the
  // floor-map -> reservation -> check-in pipeline instead; the "New Order"
  // button below only makes sense when that pipeline doesn't exist for this
  // module. Defaults to showing the button (undefined/null treated as
  // false) to match requireReservationMiddleware's own "=== false" check on
  // the backend — an unset flag means no reservation gate exists.
  requireReservation?: boolean | null;
}

interface StaffMenuItem {
  id: string;
  name: string;
  price: number;
  is_available?: boolean;
}

// ============================================
// Elapsed-time hero element
// ============================================
// Time-in-state is the thing that actually matters on a kitchen display —
// everything else (name, table, modifiers) is secondary once an order has
// been sitting for a while. Hardcoded (not the CMS `primary` token) because
// urgency color has to stay legible regardless of a tenant's brand palette.
const ELAPSED_WARN_MIN = 10;
const ELAPSED_CRIT_MIN = 20;

function useElapsedMinutes(since: string): number {
  const [minutes, setMinutes] = useState(() => Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60000)));

  useEffect(() => {
    const tick = () => setMinutes(Math.max(0, Math.floor((Date.now() - new Date(since).getTime()) / 60000)));
    tick();
    const id = setInterval(tick, 15000);
    return () => clearInterval(id);
  }, [since]);

  return minutes;
}

function ElapsedTimer({ since }: { since: string }) {
  const minutes = useElapsedMinutes(since);
  const hh = Math.floor(minutes / 60);
  const mm = minutes % 60;
  const label = hh > 0 ? `${hh}:${String(mm).padStart(2, '0')}:00` : `${mm}:00`;

  const tone =
    minutes >= ELAPSED_CRIT_MIN
      ? 'text-red-600 dark:text-red-400 animate-pulse'
      : minutes >= ELAPSED_WARN_MIN
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400';

  return (
    <span className={`font-mono tabular-nums font-bold text-lg leading-none ${tone}`}>
      {label}
    </span>
  );
}

// ============================================
// Item-level status chip — tap to advance
// ============================================
const ITEM_STATUS_STYLE: Record<ItemStatus, { bg: string; border: string; text: string; dot: string; label: string }> = {
  pending: {
    bg: 'bg-gray-50 dark:bg-gray-800',
    border: 'border-gray-200 dark:border-gray-700',
    text: 'text-gray-600 dark:text-gray-300',
    dot: 'bg-gray-400',
    label: 'Pending',
  },
  preparing: {
    bg: 'bg-amber-50 dark:bg-amber-900/20',
    border: 'border-amber-300 dark:border-amber-700',
    text: 'text-amber-700 dark:text-amber-300',
    dot: 'bg-amber-500',
    label: 'Preparing',
  },
  ready: {
    bg: 'bg-teal-50 dark:bg-teal-900/20',
    border: 'border-teal-300 dark:border-teal-700',
    text: 'text-teal-700 dark:text-teal-300',
    dot: 'bg-teal-500',
    label: 'Ready',
  },
  served: {
    bg: 'bg-gray-50 dark:bg-gray-800/60',
    border: 'border-gray-200 dark:border-gray-700',
    text: 'text-gray-400 dark:text-gray-500',
    dot: 'bg-gray-400',
    label: 'Served',
  },
};

const ITEM_NEXT_ACTION_LABEL: Record<ItemStatus, string | null> = {
  pending: 'Start',
  preparing: 'Ready',
  // Kitchen's job stops at 'ready'. Advancing an item to 'served' (and the
  // order-level auto-derivation to 'handed_off' that follows) is Dispatch's
  // action now — see DispatchBoard — not something the kitchen board offers.
  ready: null,
  served: null,
};

// ============================================
// Board columns — mode-derived (F1 resolved)
// ============================================
// Columns are now derived from each order's fulfillmentMode via
// getModeStateConfig(mode). The pending/confirmed/transaction-layer
// states are prepended as the first column; fulfillment states follow.

interface BoardColumnStyle {
  bg: string;
  border: string;
  text: string;
  action: string | null;
  actionBg: string;
  label: string;
}

/** Pending/confirmed column style — shared across all modes. */
const PENDING_COL_STYLE: BoardColumnStyle = {
  bg: 'bg-blue-50 dark:bg-blue-900/10',
  border: 'border-blue-300 dark:border-blue-700',
  text: 'text-blue-700 dark:text-blue-300',
  action: 'Confirm',
  actionBg: 'bg-blue-600 hover:bg-blue-700',
  label: 'New',
};

/** Derive the full column list and styles from a mode config.
 *  Prepends 'pending' as the first column (transaction-layer entry point)
 *  then appends the mode's ordered fulfillment states. */
function deriveBoardColumns(
  modeConfig: ModeStateConfig | null,
): { key: string; style: BoardColumnStyle }[] {
  const cols: { key: string; style: BoardColumnStyle }[] = [
    { key: 'pending', style: PENDING_COL_STYLE },
  ];
  if (modeConfig) {
    for (const state of modeConfig.states) {
      const meta = modeConfig.metadata[state];
      cols.push({
        key: state,
        style: {
          bg: meta.bg,
          border: meta.border,
          text: meta.text,
          action: meta.actionLabel,
          actionBg: meta.actionBg,
          label: meta.label,
        },
      });
    }
  }
  return cols;
}

// ============================================
// Per-order mode resolution (F1: mixed-mode board)
// ============================================
// Each order carries its own fulfillmentMode. The board must resolve
// each order against its OWN mode — never a global dominant-mode pick.

const LEGACY_MODE: FulfillmentMode = 'on_premise';

/** Resolve the fulfillment mode for a single order.
 *  - Valid known mode (on_premise, pickup, ..., none) → resolved directly.
 *  - null / undefined / unknown → legacy recovery (hospitality config,
 *    flagged for migration). 'none' is NOT legacy: it means no fulfillment
 *    machine applies (transaction-layer only).
 */
function resolvedOrderMode(order: Order): { mode: FulfillmentMode; legacy: boolean } {
  const raw = order.fulfillmentMode;
  if (raw && isFulfillmentMode(raw)) {
    return { mode: raw, legacy: false };
  }
  // Null / undefined / unrecognized → legacy recovery: apply hospitality
  // config so the order still renders, but it's flagged for migration.
  return { mode: LEGACY_MODE, legacy: true };
}

/** Collect the distinct fulfillment modes present in a set of orders,
 *  ordered by first-seen. Preserves order for tab rendering. */
function modesFromOrders(orders: Order[]): FulfillmentMode[] {
  const seen = new Set<FulfillmentMode>();
  const result: FulfillmentMode[] = [];
  for (const o of orders) {
    const { mode } = resolvedOrderMode(o);
    if (!seen.has(mode)) {
      seen.add(mode);
      result.push(mode);
    }
  }
  return result;
}

/** Human-readable tab label for a fulfillment mode. */
function modeTabLabel(mode: FulfillmentMode, legacy: boolean): string {
  const base = mode.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  return legacy ? `${base} (legacy)` : base;
}

/** Grid-cols class for a mode's column count. */
function modeGridCols(colCount: number): string {
  if (colCount <= 3) return 'grid-cols-1 md:grid-cols-3';
  if (colCount <= 4) return 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4';
  if (colCount <= 5) return 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5';
  return 'grid-cols-1 md:grid-cols-3 lg:grid-cols-6';
}

/** Which board column an order belongs in (per-order mode-aware). */
function boardColumn(order: Order, modeConfig: ModeStateConfig | null): string {
  const c = canonicalFulfillmentState(order);
  return resolveColumnKey(c, modeConfig);
}

/** Resolve modeConfig for a specific order — never uses a global mode. */
function orderModeConfig(order: Order): ModeStateConfig | null {
  const { mode } = resolvedOrderMode(order);
  return getModeStateConfig(mode);
}

/** The next canonical target state for a column's quick action.
 *  Resolves the mode from the order itself, not from a global config. */
function nextCanonicalTarget(order: Order, _modeConfig: ModeStateConfig | null): string | null {
  const cfg = orderModeConfig(order);
  const col = boardColumn(order, cfg);
  if (col === 'pending') return 'confirmed';
  if (!cfg) return null;
  return cfg.nextTarget(col as FulfillmentState);
}


function ItemStatusChip({
  item,
  onAdvance,
  disabled,
}: {
  item: OrderItem;
  onAdvance: (item: OrderItem) => void;
  disabled: boolean;
}) {
  const status = item.status ?? 'pending';
  const style = ITEM_STATUS_STYLE[status] ?? ITEM_STATUS_STYLE.pending;
  const nextLabel = ITEM_NEXT_ACTION_LABEL[status] ?? null;
  const isServed = status === 'served';

  return (
    <div className={`rounded-md border ${style.border} ${style.bg} px-2 py-1.5`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="font-medium bg-white/70 dark:bg-black/20 px-1 rounded text-[10px] shrink-0">
            {item.quantity}x
          </span>
          <span className={`text-xs truncate ${isServed ? 'line-through text-gray-400 dark:text-gray-500' : 'text-gray-700 dark:text-gray-200'}`}>
            {item.name}
          </span>
        </div>

        {isServed ? (
          <Check className="h-3.5 w-3.5 text-teal-500 shrink-0" />
        ) : nextLabel ? (
          <button
            type="button"
            disabled={disabled}
            onClick={(e) => {
              e.stopPropagation();
              onAdvance(item);
            }}
            className={`shrink-0 flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wide px-2 py-1 rounded ${style.text} bg-white dark:bg-gray-900 border ${style.border} hover:brightness-95 active:scale-95 transition disabled:opacity-40 disabled:pointer-events-none`}
          >
            {nextLabel}
            <ChevronRight className="h-3 w-3" />
          </button>
        ) : null}
      </div>

      {item.specialInstructions && (
        <p className="text-[10px] text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 px-1.5 py-0.5 rounded mt-1">
          {item.specialInstructions}
        </p>
      )}
    </div>
  );
}

export function KitchenView({ slug, moduleName, moduleId, requireReservation }: KitchenViewProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  // Items currently mid-flight to the item-status endpoint — used to disable
  // the tapped chip so a slow network doesn't invite a double-tap.
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());
  const { socket } = useSocket();
  // F1: mode-filtered board. 'all' shows a merged board; any specific mode
  // shows only that mode's columns and orders.
  const [activeModeTab, setActiveModeTab] = useState<FulfillmentMode | 'all'>('all');

  // ============================================
  // New Order / Add Item — replaces the removed window.prompt() flow.
  // Menu is loaded lazily (on first modal open) via the staff-scoped
  // /admin/items endpoint, not the customer /items one — staff need to see
  // unavailable items too, not just what's live on the public menu.
  // ============================================
  const [menuItems, setMenuItems] = useState<StaffMenuItem[]>([]);
  const [menuLoaded, setMenuLoaded] = useState(false);
  const [isNewOrderOpen, setIsNewOrderOpen] = useState(false);
  const [newOrderCart, setNewOrderCart] = useState<Map<string, number>>(new Map());
  const [newOrderTable, setNewOrderTable] = useState('');
  const [isSubmittingOrder, setIsSubmittingOrder] = useState(false);
  const [addItemCart, setAddItemCart] = useState<Map<string, number>>(new Map());
  const [isAddingItems, setIsAddingItems] = useState(false);

  const ensureMenuLoaded = async () => {
    if (menuLoaded) return;
    try {
      const response = await api.get(`/${slug}/admin/items`);
      setMenuItems(response.data?.data ?? []);
    } catch (error) {
      console.error('Failed to load staff menu:', error);
      toast.error('Failed to load menu items');
    } finally {
      setMenuLoaded(true);
    }
  };

  const adjustCartQuantity = (
    setCart: Dispatch<SetStateAction<Map<string, number>>>,
    itemId: string,
    delta: number,
  ) => {
    setCart((prev) => {
      const next = new Map(prev);
      const current = next.get(itemId) ?? 0;
      const updated = current + delta;
      if (updated <= 0) next.delete(itemId);
      else next.set(itemId, updated);
      return next;
    });
  };

  const submitNewOrder = async () => {
    if (newOrderCart.size === 0) {
      toast.error('Add at least one item');
      return;
    }
    const items = Array.from(newOrderCart.entries()).map(([menuItemId, quantity]) => ({
      catalog_item_id: menuItemId,
      menuItemId,
      quantity,
    }));
    setIsSubmittingOrder(true);
    try {
      await api.post(`/${slug}/orders`, {
        table_number: newOrderTable || undefined,
        items,
      });
      toast.success('Order created');
      setNewOrderCart(new Map());
      setNewOrderTable('');
      setIsNewOrderOpen(false);
      loadOrders();
    } catch (error) {
      if (!isOnline()) {
        await createOfflineOrder({
          moduleId,
          moduleSlug: slug,
          tableNumber: newOrderTable || undefined,
          items: items.map((i) => ({ menuItemId: i.menuItemId, quantity: i.quantity })),
        });
        toast.info('Order queued offline', { icon: '⏳' });
        setNewOrderCart(new Map());
        setNewOrderTable('');
        setIsNewOrderOpen(false);
        return;
      }
      console.error('Failed to create order:', error);
      toast.error('Failed to create order');
    } finally {
      setIsSubmittingOrder(false);
    }
  };

  // Add item(s) to an already-open order — see POST /:slug/orders/:id/items
  // on the backend. Online-only for now: unlike order creation and
  // order-level status updates, there's no offline replay path wired for
  // this yet, and a kitchen-side "add to an order that already exists"
  // action is far less likely to happen mid-outage than initial order entry.
  const submitAddItems = async (orderId: string) => {
    if (addItemCart.size === 0) {
      toast.error('Add at least one item');
      return;
    }
    if (!isOnline()) {
      toast.error('Adding items needs a connection');
      return;
    }
    const items = Array.from(addItemCart.entries()).map(([menuItemId, quantity]) => ({
      catalog_item_id: menuItemId,
      menuItemId,
      quantity,
    }));
    setIsAddingItems(true);
    try {
      await api.post(`/${slug}/orders/${orderId}/items`, { items });
      toast.success('Items added to order');
      setAddItemCart(new Map());
      loadOrders();
    } catch (error) {
      console.error('Failed to add items:', error);
      toast.error('Failed to add items to order');
    } finally {
      setIsAddingItems(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [moduleId]);

  // Fresh cart per order — otherwise a leftover selection from whichever
  // order was open last would silently ride along into a different order.
  useEffect(() => {
    setAddItemCart(new Map());
  }, [selectedOrder?.id]);

  useEffect(() => {
    if (socket && moduleId) {
      socket.emit('join:unit', moduleId);
      socket.emit('join:unit', slug);

      const handleNewOrder = (newOrder: Order) => {
        setOrders((prev) => [newOrder, ...prev]);
        toast.info(`New order #${newOrder.orderNumber}`, {
          description: newOrder.customerName,
        });
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
      };

      interface StatusUpdate {
        id: string;
        status: string;
        // Canonical type — the payload is validated at the boundary rather
        // than smuggled in as an arbitrary string (plan F1).
        fulfillmentStatus?: FulfillmentStatus | null;
      }

      const handleStatusUpdate = (update: StatusUpdate) => {
        setOrders((prev) =>
          prev.map((order) =>
            // Payload key is `id` (order-status.service.ts); accept
            // `orderId` too for older emitters.
            order.id === update.id || order.id === (update as { orderId?: string }).orderId
              ? {
                  ...order,
                  status: update.status,
                  // Stage 6: fulfillment moves carry the canonical state
                  // here; the board columns key off it.
                  fulfillmentStatus: update.fulfillmentStatus ?? order.fulfillmentStatus,
                }
              : order
          )
        );
      };

      // New: item-level status, emitted by PATCH .../items/:itemId/status.
      // Keeps every open KDS screen (multiple stations, expo, etc.) in sync
      // when one of them bumps an item.
      interface ItemStatusUpdate {
        orderId: string;
        itemId: string;
        status: ItemStatus;
      }

      const handleItemStatusUpdate = (update: ItemStatusUpdate) => {
        setOrders((prev) =>
          prev.map((order) =>
            order.id === update.orderId
              ? {
                  ...order,
                  items: order.items.map((item) =>
                    item.id === update.itemId ? { ...item, status: update.status } : item
                  ),
                }
              : order
          )
        );
      };

      socket.on('order:new', handleNewOrder);
      socket.on('order:status', handleStatusUpdate);
      socket.on('order:item:status', handleItemStatusUpdate);
      socket.on('new-order', handleNewOrder);
      socket.on('order-status-updated', handleStatusUpdate);

      return () => {
        // FIX Iter-13: Leave socket rooms on cleanup to prevent room leak
        socket.emit('leave:unit', moduleId);
        socket.emit('leave:unit', slug);
        socket.off('order:new', handleNewOrder);
        socket.off('order:status', handleStatusUpdate);
        socket.off('order:item:status', handleItemStatusUpdate);
        socket.off('new-order', handleNewOrder);
        socket.off('order-status-updated', handleStatusUpdate);
      };
    }
  }, [socket, moduleId, slug]);

  const loadOrders = async () => {
    // 1. Load from offline store immediately
    const offlineOrders = await ordersStore.getAll();
    if (offlineOrders.length > 0) {
      setOrders(offlineOrders as unknown as Order[]);
      setIsLoading(false);
    }

    // 2. Refresh from API in background if online
    if (isOnline()) {
      try {
        const response = await api.get(`/staff/modules/${slug}/orders`, {
          params: {
            // Stage 6: 'confirmed' (the transaction layer every fulfillment-
            // active order sits at) plus ALL canonical fulfillment states.
            // 'pending' excluded — only confirmed orders reach the kitchen.
            // Includes states from all fulfillment modes (F1: mixed-mode board).
            status: 'confirmed,queued,in_progress,ready,handed_off,provisioning,provisioned,delivered,allocated,picking,packed,shipped,in_transit,received,working,collected',
            moduleId: moduleId,
          },
        });
        const freshOrders = response.data.data || [];
        setOrders(freshOrders);

        // 3. Update offline store
        await ordersStore.clear();
        await ordersStore.putMany(freshOrders);
        await cacheManager.updateMetadata('orders', freshOrders.length);
      } catch (error) {
        console.error('Background orders refresh failed:', error);
        if (offlineOrders.length === 0) {
          toast.error('Failed to load orders');
        }
      } finally {
        setIsLoading(false);
      }
    } else if (offlineOrders.length === 0) {
      toast.error('Offline and no cached orders found');
      setIsLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.patch(`/staff/modules/${slug}/orders/${orderId}/status`, {
        status: newStatus,
      });
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                // Stage 6: fulfillment-layer moves update fulfillmentStatus
                // (the board's key); transaction-layer moves update status.
                ...(FULFILLMENT_LAYER_STATES.includes(newStatus as FulfillmentState)
                  ? { fulfillmentStatus: newStatus as FulfillmentStatus }
                  : { status: newStatus }),
              }
            : order
        )
      );
      toast.success(`Order updated to ${newStatus}`);
      setSelectedOrder(null);
    } catch (error) {
      if (!isOnline()) {
        await createOfflineOrderStatusUpdate(orderId, newStatus);
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId
              ? {
                  ...order,
                  ...(FULFILLMENT_LAYER_STATES.includes(newStatus as FulfillmentState)
                    ? { fulfillmentStatus: newStatus as FulfillmentStatus }
                    : { status: newStatus }),
                }
              : order
          )
        );
        toast.info('Order updated offline', { icon: '⏳' });
        setSelectedOrder(null);
        return;
      }
      toast.error('Failed to update order status');
    }
  };

  // Item-level status is deliberately online-only. Order-level updates have
  // an offline queue (createOfflineOrderStatusUpdate) with a sync-replay path
  // on the backend; wiring the same for individual order_items would mean
  // teaching that replay logic a second entity type for a workflow that's
  // rare to hit offline in the first place (a KDS is usually on stable wifi
  // in the kitchen, unlike a server's handheld). Known gap, same call as the
  // backend made for per-item cancel — documented rather than silently
  // half-built. If it's actually offline, staff fall back to the existing
  // whole-order "Advance Status" action below, which does queue.
  const advanceItem = async (orderId: string, item: OrderItem) => {
    const currentStatus = item.status ?? 'pending';
    const nextIndex = itemStatusFlow.indexOf(currentStatus) + 1;
    const nextStatus = itemStatusFlow[nextIndex];
    if (!nextStatus) return;

    if (!isOnline()) {
      toast.error('Item updates need a connection', {
        description: 'Use "Advance Status" on the order instead — it queues offline.',
      });
      return;
    }

    setPendingItemIds((prev) => new Set(prev).add(item.id));

    // Optimistic update
    setOrders((prev) =>
      prev.map((order) =>
        order.id === orderId
          ? {
              ...order,
              items: order.items.map((i) => (i.id === item.id ? { ...i, status: nextStatus } : i)),
            }
          : order
      )
    );

    try {
      await api.patch(`/staff/modules/${slug}/orders/${orderId}/items/${item.id}/status`, {
        status: nextStatus,
      });
      // Order-level auto-derivation (ready/served once every item matches)
      // arrives over the 'order:status' socket event handled above, so no
      // need to guess at it here.
    } catch (error) {
      // Roll back the optimistic bump
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? {
                ...order,
                items: order.items.map((i) => (i.id === item.id ? { ...i, status: currentStatus } : i)),
              }
            : order
        )
      );
      toast.error(`Failed to update ${item.name}`);
    } finally {
      setPendingItemIds((prev) => {
        const next = new Set(prev);
        next.delete(item.id);
        return next;
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      {/* Header */}
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <ChefHat className="h-8 w-8 text-primary" />
            {moduleName} Kitchen
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage incoming orders and kitchen workflow
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Only shown when this module has no reservation/check-in pipeline
              to create orders through — see requireReservation doc above. */}
          {requireReservation === false && (
            <Button
              onClick={() => {
                setIsNewOrderOpen(true);
                ensureMenuLoaded();
              }}
            >
              <ShoppingCart className="h-4 w-4 mr-1.5" />
              New Order
            </Button>
          )}
          <div className="bg-white dark:bg-gray-800 px-4 py-2 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 flex items-center gap-2">
            <Clock className="h-4 w-4 text-primary" />
            <span className="font-mono font-medium">
              {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          <Button variant="outline" size="icon" onClick={() => loadOrders()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Kanban Board — F1: mode-filtered tabs.
          Each order is resolved against its OWN fulfillmentMode via
          resolvedOrderMode(). The board shows mode-specific columns;
          the transaction layer owns pending/confirmed/completed/cancelled.
          transactions.status is never used for column placement. */}
      {(() => {
        const modes = modesFromOrders(orders);
        const showTabs = modes.length > 1 || (modes.length === 1 && modes[0] !== 'on_premise');

        // Determine which modes to render columns for.
        const renderModes: FulfillmentMode[] =
          activeModeTab === 'all' ? modes : [activeModeTab];

        // When viewing a single mode, only show orders of that mode.
        // When viewing 'all', show all orders (each resolved to its own columns).
        const visibleOrders =
          activeModeTab === 'all' ? orders : orders.filter((o) => resolvedOrderMode(o).mode === activeModeTab);

        return (
          <>
            {/* Mode Tabs */}
            {showTabs && (
              <div className="flex gap-1 mb-4 overflow-x-auto pb-1">
                <button
                  type="button"
                  data-testid="mode-tab-all"
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                    activeModeTab === 'all'
                      ? 'bg-primary text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                  }`}
                  onClick={() => setActiveModeTab('all')}
                >
                  All ({orders.length})
                </button>
                {modes.map((m) => {
                  const count = orders.filter((o) => resolvedOrderMode(o).mode === m).length;
                  const { legacy } = resolvedOrderMode(orders.find((o) => resolvedOrderMode(o).mode === m)!);
                  return (
                    <button
                      key={m}
                      type="button"
                      data-testid={`mode-tab-${m}`}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition ${
                        activeModeTab === m
                          ? 'bg-primary text-white'
                          : 'bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700'
                      }`}
                      onClick={() => setActiveModeTab(m)}
                    >
                      {modeTabLabel(m, legacy)} ({count})
                    </button>
                  );
                })}
              </div>
            )}

            {/* Board columns — one set per rendered mode. */}
            {renderModes.length === 0 ? (
              <div className="text-center py-12 text-gray-400 dark:text-gray-600">
                <UtensilsCrossed className="h-12 w-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No active orders</p>
              </div>
            ) : renderModes.map((rm) => {
              const rmConfig = getModeStateConfig(rm);
              const boardColumns = deriveBoardColumns(rmConfig);
              // Filter visible orders to this mode's orders
              const modeOrders = visibleOrders.filter((o) => resolvedOrderMode(o).mode === rm);
              const { legacy } = resolvedOrderMode(modeOrders[0] ?? { fulfillmentMode: rm });

              return (
                <div key={rm} className="mb-6">
                  {/* Mode section header when showing multiple modes */}
                  {renderModes.length > 1 && (
                    <div className="flex items-center gap-2 mb-3">
                      <h2 className="text-sm font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
                        {modeTabLabel(rm, legacy)}
                      </h2>
                      <span className="text-xs text-gray-400 dark:text-gray-500">
                        {modeOrders.length} order{modeOrders.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                  )}
                  <div className={`grid gap-4 overflow-x-auto ${modeGridCols(boardColumns.length)}`}>
                    {boardColumns.map(({ key: status, style: col }) => {
                      const columnOrders = modeOrders.filter((o) => {
                        const oCfg = orderModeConfig(o);
                        return boardColumn(o, oCfg) === status;
                      });

                      return (
                        <div key={status} className={`rounded-xl border ${col.border} ${col.bg} min-h-[400px] flex flex-col`}>
                          {/* Column Header */}
                          <div className="p-3 border-b border-inherit flex items-center justify-between">
                            <h3 className={`font-bold text-sm uppercase tracking-wide ${col.text}`}>
                              {col.label}
                            </h3>
                            <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${col.text} bg-white/60 dark:bg-gray-800/60`}>
                              {columnOrders.length}
                            </span>
                          </div>

                          {/* Column Cards */}
                          <div className="p-2 space-y-2 flex-1 overflow-y-auto max-h-[calc(100vh-280px)]">
                            {columnOrders.length === 0 ? (
                              <div className="flex flex-col items-center justify-center py-8 text-gray-400 dark:text-gray-600">
                                <UtensilsCrossed className="h-8 w-8 mb-2 opacity-30" />
                                <p className="text-xs">No orders</p>
                              </div>
                            ) : (
                              columnOrders.map((order) => {
                                const oCfg = orderModeConfig(order);
                                const oCol = boardColumn(order, oCfg);
                                return (
                                  <div
                                    key={order.id}
                                    data-testid={`order-card-${order.id}`}
                                    data-fulfillment-mode={resolvedOrderMode(order).mode}
                                    data-fulfillment-column={oCol}
                                    className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden transition-all hover:shadow-md cursor-pointer ${
                                      selectedOrder?.id === order.id ? 'ring-2 ring-primary' : ''
                                    }`}
                                  >
                                    <div className="p-3">
                                      <div className="flex justify-between items-start mb-2">
                                        <div className="flex items-center gap-1.5">
                                          <span className="font-bold text-sm">#{order.orderNumber}</span>
                                          {order.tableNumber && (
                                            <span className="bg-gray-100 dark:bg-gray-700 px-1.5 py-0.5 rounded text-[10px] font-medium">
                                              T-{order.tableNumber}
                                            </span>
                                          )}
                                          {/* Show fulfillment mode badge on the card when multiple modes are visible */}
                                          {renderModes.length > 1 && (
                                            <span className="bg-gray-200 dark:bg-gray-600 px-1.5 py-0.5 rounded text-[9px] font-medium text-gray-600 dark:text-gray-300">
                                              {resolvedOrderMode(order).mode.replace(/_/g, ' ')}
                                            </span>
                                          )}
                                        </div>
                                        {/* Elapsed timer — the hero element. What matters on a
                                            KDS is time-in-state, not just what was ordered. */}
                                        <ElapsedTimer since={order.createdAt} />
                                      </div>

                                      <div className="flex items-center justify-between mb-2">
                                        <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${
                                          order.orderType === 'dine_in' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                                          : order.orderType === 'delivery' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                                          : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                                        }`}>
                                          {order.orderType?.replace('_', ' ') || 'dine in'}
                                        </span>
                                        <span className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400">
                                          <Clock className="h-3 w-3" />
                                          {formatTime(order.createdAt)}
                                        </span>
                                      </div>

                                      <div className="space-y-1 mb-2">
                                        {order.items.map((item) => (
                                          <ItemStatusChip
                                            key={item.id}
                                            item={item}
                                            disabled={pendingItemIds.has(item.id)}
                                            onAdvance={(i) => advanceItem(order.id, i)}
                                          />
                                        ))}
                                      </div>

                                      <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700 text-xs">
                                        <span className="text-gray-500 truncate max-w-[80px]">{order.customerName}</span>
                                        <span className="font-bold text-primary">{formatCurrency(order.totalAmount)}</span>
                                      </div>
                                    </div>

                                    {/* Quick Action — per-order mode-resolved.
                                        pending→confirmed is a transaction-layer move;
                                        mode-specific states are fulfillment-layer moves. */}
                                    {(() => {
                                      const nextTarget = nextCanonicalTarget(order, oCfg);
                                      const isWaitingOnDispatch = oCol === 'ready';
                                      if (!nextTarget && !isWaitingOnDispatch) return null;
                                      return (
                                        <div className="px-2 pb-2 flex gap-2">
                                          {isWaitingOnDispatch ? (
                                            <span className="w-full text-center text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 py-1.5">
                                              Waiting on Dispatch
                                            </span>
                                          ) : (
                                            <Button
                                              className={`w-full text-white text-xs ${col.actionBg}`}
                                              size="sm"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                updateOrderStatus(order.id, nextTarget!);
                                              }}
                                            >
                                              {col.action}
                                            </Button>
                                          )}
                                        </div>
                                      );
                                    })()}
                                  </div>
                                );
                              })
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </>
        );
      })()}

      {/* Order Details Modal */}
      {selectedOrder && (() => {
        // F1: resolve mode for the detail panel from the order itself.
        const selModeCfg = orderModeConfig(selectedOrder);
        const { mode: selMode, legacy: selLegacy } = resolvedOrderMode(selectedOrder);
        return (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          role="dialog" // FIX Iter-11: a11y — modal semantics
          aria-modal="true" // FIX Iter-11: a11y
          aria-label={`Order #${selectedOrder.orderNumber} details`} // FIX Iter-11: a11y
          onKeyDown={(e) => { if (e.key === 'Escape') setSelectedOrder(null); }} // FIX Iter-11: a11y — Escape to close
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h2 className="text-xl font-bold flex items-center gap-2">
                  Order #{selectedOrder.orderNumber}
                  <span className="text-sm font-normal text-gray-500 bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded-full">
                    {selectedOrder.orderType}
                  </span>
                  <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500 bg-gray-50 dark:bg-gray-800 px-1.5 py-0.5 rounded">
                    {selMode}{selLegacy ? ' (legacy)' : ''}
                  </span>
                </h2>
                <p className="text-sm text-gray-500 mt-1 flex items-center gap-2">
                  <span>{formatTime(selectedOrder.createdAt)} • {selectedOrder.customerName}</span>
                  <ElapsedTimer since={selectedOrder.createdAt} />
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                aria-label="Close order details" // FIX Iter-11: a11y
                onClick={() => setSelectedOrder(null)}
              >
                <XCircle className="h-6 w-6" />
              </Button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <div className="space-y-2">
                {selectedOrder.items.map((item) => (
                  <ItemStatusChip
                    key={item.id}
                    item={item}
                    disabled={pendingItemIds.has(item.id)}
                    onAdvance={(i) => advanceItem(selectedOrder.id, i)}
                  />
                ))}
              </div>

              <div className="mt-6 bg-gray-50 dark:bg-gray-700/30 p-4 rounded-lg space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Status</span>
                  <span className="font-medium capitalize">
                    {canonicalFulfillmentState(selectedOrder) ?? selectedOrder.status}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Table</span>
                  <span className="font-medium">{selectedOrder.tableNumber || 'N/A'}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-600">
                  <span>Total</span>
                  <span>{formatCurrency(selectedOrder.totalAmount)}</span>
                </div>
              </div>

              {/* Add item(s) to this order — the increment path that was
                  missing entirely before (see POST /:slug/orders/:id/items).
                  Not offered on a terminal order; matches the backend's own
                  completed/cancelled check. */}
              {selectedOrder.status !== 'completed' && selectedOrder.status !== 'cancelled' && (
                <div className="mt-4 border border-dashed border-gray-300 dark:border-gray-600 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-sm font-semibold text-gray-700 dark:text-gray-200">Add Item</h3>
                    {!menuLoaded && (
                      <button
                        type="button"
                        className="text-xs text-primary underline"
                        onClick={ensureMenuLoaded}
                      >
                        Load menu
                      </button>
                    )}
                  </div>
                  {menuLoaded && (
                    <>
                      <div className="max-h-40 overflow-y-auto space-y-1">
                        {menuItems.map((mi) => {
                          const qty = addItemCart.get(mi.id) ?? 0;
                          return (
                            <div key={mi.id} className="flex items-center justify-between text-sm py-1">
                              <span className="truncate flex-1">{mi.name}</span>
                              <span className="text-gray-400 text-xs mr-2">{formatCurrency(mi.price)}</span>
                              <div className="flex items-center gap-1.5">
                                <button
                                  type="button"
                                  className="p-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-30"
                                  disabled={qty === 0}
                                  onClick={() => adjustCartQuantity(setAddItemCart, mi.id, -1)}
                                >
                                  <Minus className="h-3 w-3" />
                                </button>
                                <span className="w-5 text-center text-xs">{qty}</span>
                                <button
                                  type="button"
                                  className="p-1 rounded border border-gray-200 dark:border-gray-600"
                                  onClick={() => adjustCartQuantity(setAddItemCart, mi.id, 1)}
                                >
                                  <Plus className="h-3 w-3" />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                      <Button
                        className="w-full mt-3"
                        size="sm"
                        disabled={addItemCart.size === 0 || isAddingItems}
                        onClick={() => submitAddItems(selectedOrder.id)}
                      >
                        {isAddingItems ? 'Adding…' : 'Add to Order'}
                      </Button>
                    </>
                  )}
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col gap-3">
              <div className="flex gap-3">
                {(() => {
                  // F1: resolve mode from the order itself — never from a global pick.
                  const selModeConfig = orderModeConfig(selectedOrder);
                  const nextTarget = nextCanonicalTarget(selectedOrder, selModeConfig);
                  const selCol = boardColumn(selectedOrder, selModeConfig);
                  const isTerminal = selectedOrder.status === 'completed' || selectedOrder.status === 'cancelled';
                  if (!isTerminal && nextTarget && selCol !== 'ready') {
                    return (
                      <Button
                        className="flex-1"
                        onClick={() => {
                          updateOrderStatus(selectedOrder.id, nextTarget);
                          setSelectedOrder(null);
                        }}
                      >
                        Advance Status
                      </Button>
                    );
                  }
                  if (selCol === 'ready' && !isTerminal) {
                    return (
                      <div className="flex-1 flex items-center justify-center text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                        Waiting on Dispatch
                      </div>
                    );
                  }
                  return null;
                })()}
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </Button>
            </div>
          </div>
        </div>
        );
      })()}
      {/* Order Details Modal ... */}

      {/* New Order Modal — replaces the removed window.prompt() flow with a
          real item picker against the staff menu, for modules that have no
          reservation pipeline (require_reservation === false) to create
          orders through otherwise. */}
      {isNewOrderOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="New order"
          onKeyDown={(e) => { if (e.key === 'Escape') setIsNewOrderOpen(false); }}
        >
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="p-6 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
              <h2 className="text-xl font-bold">New Order</h2>
              <Button variant="ghost" size="icon" aria-label="Close" onClick={() => setIsNewOrderOpen(false)}>
                <XCircle className="h-6 w-6" />
              </Button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400">Table number (optional)</label>
                <input
                  type="text"
                  value={newOrderTable}
                  onChange={(e) => setNewOrderTable(e.target.value)}
                  className="mt-1 w-full rounded-md border border-gray-200 dark:border-gray-600 bg-transparent px-3 py-2 text-sm"
                  placeholder="e.g. 12"
                />
              </div>

              <div>
                <label className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1 block">Items</label>
                {!menuLoaded ? (
                  <div className="flex items-center justify-center py-6">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-primary"></div>
                  </div>
                ) : menuItems.length === 0 ? (
                  <p className="text-sm text-gray-400 py-4 text-center">No menu items found</p>
                ) : (
                  <div className="space-y-1">
                    {menuItems.map((mi) => {
                      const qty = newOrderCart.get(mi.id) ?? 0;
                      return (
                        <div key={mi.id} className="flex items-center justify-between text-sm py-1.5 border-b border-gray-50 dark:border-gray-700/50 last:border-0">
                          <div className="min-w-0 flex-1">
                            <span className="truncate block">{mi.name}</span>
                            {mi.is_available === false && (
                              <span className="text-[10px] text-red-500">Unavailable</span>
                            )}
                          </div>
                          <span className="text-gray-400 text-xs mr-3">{formatCurrency(mi.price)}</span>
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              className="p-1 rounded border border-gray-200 dark:border-gray-600 disabled:opacity-30"
                              disabled={qty === 0}
                              onClick={() => adjustCartQuantity(setNewOrderCart, mi.id, -1)}
                            >
                              <Minus className="h-3 w-3" />
                            </button>
                            <span className="w-5 text-center text-xs">{qty}</span>
                            <button
                              type="button"
                              className="p-1 rounded border border-gray-200 dark:border-gray-600"
                              onClick={() => adjustCartQuantity(setNewOrderCart, mi.id, 1)}
                            >
                              <Plus className="h-3 w-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setIsNewOrderOpen(false)}>
                Cancel
              </Button>
              <Button
                className="flex-1"
                disabled={newOrderCart.size === 0 || isSubmittingOrder}
                onClick={submitNewOrder}
              >
                {isSubmittingOrder ? 'Creating…' : 'Create Order'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="mt-auto">
        <DataFreshnessFooter storeName="orders" />
      </footer>
    </div>
  );
}
