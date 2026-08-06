'use client';

import { useEffect, useState } from 'react';
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
} from 'lucide-react';
import { Order, OrderItem, ItemStatus, statusFlow, itemStatusFlow } from './types';

import { isOnline, ordersStore, cacheManager } from '@/lib/offline/offline-storage';
import { createOfflineOrderStatusUpdate, createOfflineOrder, createOfflineCashPayment } from '@/lib/offline/offline-sync';
import { DataFreshnessFooter } from '@/components/offline/DataFreshnessFooter';

export interface KitchenViewProps {
  slug: string;
  moduleName: string;
  moduleId: string;
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
  // order-level auto-derivation to 'delivered' that follows) is Dispatch's
  // action now — see DispatchBoard — not something the kitchen board offers.
  ready: null,
  served: null,
};

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
  const style = ITEM_STATUS_STYLE[status];
  const nextLabel = ITEM_NEXT_ACTION_LABEL[status];
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

export function KitchenView({ slug, moduleName, moduleId }: KitchenViewProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  // Items currently mid-flight to the item-status endpoint — used to disable
  // the tapped chip so a slow network doesn't invite a double-tap.
  const [pendingItemIds, setPendingItemIds] = useState<Set<string>>(new Set());
  const { socket } = useSocket();

  useEffect(() => {
    loadOrders();
  }, [moduleId]);

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
        orderId: string;
        status: string;
      }

      const handleStatusUpdate = (update: StatusUpdate) => {
        setOrders((prev) =>
          prev.map((order) =>
            order.id === update.orderId
              ? { ...order, status: update.status }
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
            // 'delivered' is the engine's real name for this step (see
            // instant-transaction.ts) — the board used to ask for 'served'
            // here, which no order could ever actually reach.
            status: 'pending,confirmed,preparing,ready,delivered',
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
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
      toast.success(`Order updated to ${newStatus}`);
      setSelectedOrder(null);
    } catch (error) {
      if (!isOnline()) {
        await createOfflineOrderStatusUpdate(orderId, newStatus);
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, status: newStatus } : order
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

  const createStaffOrder = async () => {
    try {
      const itemId = window.prompt('Menu item ID');
      if (!itemId) return;
      const quantityRaw = window.prompt('Quantity', '1');
      const quantity = Number(quantityRaw || '1');
      if (!Number.isFinite(quantity) || quantity < 1) {
        toast.error('Invalid quantity');
        return;
      }
      const tableNumber = window.prompt('Table number (optional)') || undefined;

      const orderData = {
        tableId: tableNumber, // API expects tableId or table_number depending on endpoint
        items: [{ menuItemId: itemId, quantity }],
      };

      try {
        await api.post(`/${slug}/orders`, {
          table_number: tableNumber,
          items: [{ catalog_item_id: itemId, quantity }],
        });
        toast.success('Staff order created');
        loadOrders();
      } catch (error) {
        if (!isOnline()) {
          await createOfflineOrder(orderData as any);
          toast.info('Staff order queued offline', { icon: '⏳' });
          return;
        }
        toast.error('Failed to create staff order');
      }
    } catch (error) {
      toast.error('Failed to create staff order');
    }
  };

  const splitBill = async (orderId: string) => {
    try {
      const partsRaw = window.prompt('Split into how many parts?', '2');
      const parts = Number(partsRaw || '2');
      if (!Number.isFinite(parts) || parts < 2) {
        toast.error('Invalid split parts');
        return;
      }
      await api.post(`/${slug}/orders/${orderId}/split`, { method: 'equal', parts });
      toast.success('Bill split created');
      loadOrders();
    } catch (error: any) {
      toast.error(error?.response?.data?.error || 'Failed to split bill');
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
          <Button onClick={createStaffOrder}>New Order</Button>
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

      {/* Kanban Board */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4 overflow-x-auto">
        {statusFlow.map((status) => {
          const columnOrders = orders.filter((o) => o.status === status);
          const columnColors: Record<string, { bg: string; border: string; text: string; action: string; actionBg: string; label: string }> = {
            pending: { bg: 'bg-yellow-50 dark:bg-yellow-900/10', border: 'border-yellow-300 dark:border-yellow-700', text: 'text-yellow-700 dark:text-yellow-300', action: 'Accept', actionBg: 'bg-green-600 hover:bg-green-700', label: 'Pending' },
            confirmed: { bg: 'bg-blue-50 dark:bg-blue-900/10', border: 'border-blue-300 dark:border-blue-700', text: 'text-blue-700 dark:text-blue-300', action: 'Start Prep', actionBg: 'bg-blue-600 hover:bg-blue-700', label: 'Confirmed' },
            preparing: { bg: 'bg-orange-50 dark:bg-orange-900/10', border: 'border-orange-300 dark:border-orange-700', text: 'text-orange-700 dark:text-orange-300', action: 'Mark Ready', actionBg: 'bg-orange-500 hover:bg-orange-600', label: 'Preparing' },
            ready: { bg: 'bg-green-50 dark:bg-green-900/10', border: 'border-green-300 dark:border-green-700', text: 'text-green-700 dark:text-green-300', action: 'Served', actionBg: 'bg-emerald-600 hover:bg-emerald-700', label: 'Ready' },
            // Key is 'delivered' to match the engine's real status name — label
            // stays 'Served' since that's the term staff actually use.
            delivered: { bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-300 dark:border-purple-700', text: 'text-purple-700 dark:text-purple-300', action: 'Complete', actionBg: 'bg-gray-600 hover:bg-gray-700', label: 'Served' },
          };
          const col = columnColors[status] || columnColors.pending;
          const nextStatus = statusFlow[statusFlow.indexOf(status) + 1];

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
                  columnOrders.map((order) => (
                    <div
                      key={order.id}
                      className={`bg-white dark:bg-gray-800 rounded-lg shadow-sm overflow-hidden transition-all hover:shadow-md cursor-pointer ${
                        selectedOrder?.id === order.id ? 'ring-2 ring-primary' : ''
                      }`}
                      onClick={() => setSelectedOrder(order)}
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

                      {/* Quick Action — order-level. Still needed for the
                          pending→confirmed→preparing steps, since order_items
                          has no 'confirmed' equivalent; items only drive
                          auto-derivation once everything hits ready/served. */}
                      {(nextStatus || ['confirmed', 'preparing', 'ready', 'delivered'].includes(order.status)) && (
                        <div className="px-2 pb-2 flex gap-2">
                          {order.status === 'ready' ? (
                            // No quick-action here on purpose: bumping straight
                            // from ready to delivered from the kitchen board
                            // skips Dispatch entirely. That handoff now only
                            // happens from DispatchBoard.
                            <span className="w-full text-center text-[11px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400 py-1.5">
                              Waiting on Dispatch
                            </span>
                          ) : (
                            <Button
                              className={`w-full text-white text-xs ${col.actionBg}`}
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                updateOrderStatus(order.id, nextStatus);
                              }}
                            >
                              {col.action}
                            </Button>
                          )}
                          {['confirmed', 'preparing', 'ready', 'delivered'].includes(order.status) && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                splitBill(order.id);
                              }}
                            >
                              Split Bill
                            </Button>
                          )}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
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
                  <span className="font-medium capitalize">{selectedOrder.status}</span>
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
            </div>

            <div className="p-6 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 flex flex-col gap-3">
              <div className="flex gap-3">
                {selectedOrder.status !== 'completed' && (
                  <Button
                    className="bg-green-600 hover:bg-green-700 text-white flex-1"
                    onClick={async () => {
                      if (isOnline()) {
                        await api.post('/payments/cash', {
                          referenceType: 'restaurant_order',
                          referenceId: selectedOrder.id,
                          amount: selectedOrder.totalAmount
                        });
                        toast.success('Payment recorded');
                      } else {
                        await createOfflineCashPayment({
                          referenceType: 'restaurant_order',
                          referenceId: selectedOrder.id,
                          amount: selectedOrder.totalAmount
                        });
                        toast.info('Cash payment queued offline', { icon: '💵' });
                      }
                      setSelectedOrder(null);
                    }}
                  >
                    Record Cash Payment
                  </Button>
                )}
                {selectedOrder.status !== 'completed' && selectedOrder.status !== 'ready' && (
                  <Button
                    className="flex-1"
                    onClick={() => {
                      const nextStatus = statusFlow[statusFlow.indexOf(selectedOrder.status) + 1];
                      if (nextStatus) {
                        updateOrderStatus(selectedOrder.id, nextStatus);
                        setSelectedOrder(null);
                      }
                    }}
                  >
                    Advance Status
                  </Button>
                )}
                {selectedOrder.status === 'ready' && (
                  <div className="flex-1 flex items-center justify-center text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
                    Waiting on Dispatch
                  </div>
                )}
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
      )}
      {/* Order Details Modal ... */}

      {/* Footer */}
      <footer className="mt-auto">
        <DataFreshnessFooter storeName="orders" />
      </footer>
    </div>
  );
}
