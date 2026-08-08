'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/lib/socket';
import { formatCurrency } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Truck, Clock, RefreshCw, MapPin, User, CheckCircle2 } from 'lucide-react';
import { Order, ItemStatus } from './types';
import { PaymentDialog } from './PaymentDialog';

export interface DispatchBoardProps {
  slug: string;
  moduleName: string;
  moduleId: string;
}

// ============================================
// Elapsed-time hero element
// ============================================
// Deliberately duplicated from KitchenView.tsx's ElapsedTimer rather than
// imported — it's ~15 lines and this is the second place that needs it. If
// a third view ends up needing it too, pull it into a shared component;
// two call sites doesn't justify the indirection yet.
const ELAPSED_WARN_MIN = 5;
const ELAPSED_CRIT_MIN = 12;

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

  // Thresholds are tighter than the kitchen board's (5/12 vs 10/20) on
  // purpose — this timer starts counting from when the order first became
  // ready, not from order creation, so "sitting on the pass too long" means
  // something different here and should go red sooner.
  const tone =
    minutes >= ELAPSED_CRIT_MIN
      ? 'text-red-600 dark:text-red-400 animate-pulse'
      : minutes >= ELAPSED_WARN_MIN
      ? 'text-amber-600 dark:text-amber-400'
      : 'text-emerald-600 dark:text-emerald-400';

  return (
    <span className={`font-mono tabular-nums font-bold text-sm leading-none ${tone}`}>
      {label}
    </span>
  );
}

const UNASSIGNED_LABEL = 'No destination on file';

export function DispatchBoard({ slug, moduleName, moduleId }: DispatchBoardProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [pendingOrderIds, setPendingOrderIds] = useState<Set<string>>(new Set());
  const [paymentOrder, setPaymentOrder] = useState<Order | null>(null);
  const { socket } = useSocket();

  const loadOrders = async () => {
    try {
      const response = await api.get(`/staff/modules/${slug}/orders`, {
        params: {
          // Dispatch only cares about orders that have cleared the kitchen
          // and are waiting for hand-off. Anything earlier isn't its job;
          // anything later (delivered/completed) has already left the board.
          status: 'ready',
          moduleId,
        },
      });
      setOrders(response.data.data || []);
    } catch (error) {
      console.error('Failed to load dispatch orders:', error);
      toast.error('Failed to load orders waiting on dispatch');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [moduleId]);

  useEffect(() => {
    if (socket && moduleId) {
      socket.emit('join:unit', moduleId);
      socket.emit('join:unit', slug);

      interface StatusUpdate {
        orderId: string;
        status: string;
      }

      // An order can arrive at 'ready' from the kitchen board's own
      // auto-derivation (all items hit ready), or leave 'ready' if another
      // open dispatch screen (or a manager override) moves it. Either way,
      // this board's whole job is showing exactly the set of orders
      // currently in 'ready' — so just refetch on any status touch rather
      // than trying to patch state incrementally for a list that's this
      // small and this order-sensitive.
      const handleStatusUpdate = (update: StatusUpdate) => {
        if (update.status === 'ready') {
          loadOrders();
        } else {
          setOrders((prev) => prev.filter((order) => order.id !== update.orderId));
        }
      };

      socket.on('order:status', handleStatusUpdate);

      return () => {
        socket.off('order:status', handleStatusUpdate);
      };
    }
  }, [socket, moduleId, slug]);

  // Marks every item on the order 'served'. By the time an order shows up
  // here its status is already 'ready', which the backend only derives once
  // every item independently hit 'ready' (see the auto-derivation in
  // updateModuleOrderItemStatus) — so all items are safe to bump together
  // in one action. This is deliberately still item-level PATCHes rather than
  // a new order-level endpoint: it's the exact mechanism KitchenView already
  // used before being capped at 'ready', so 'served' continues to mean the
  // same thing everywhere it's set, and no new backend surface is needed.
  const markDelivered = async (order: Order) => {
    if (pendingOrderIds.has(order.id)) return;

    setPendingOrderIds((prev) => new Set(prev).add(order.id));
    const readyItems = order.items.filter((item) => (item.status ?? 'pending') === 'ready');

    try {
      await Promise.all(
        readyItems.map((item) =>
          api.patch(`/staff/modules/${slug}/orders/${order.id}/items/${item.id}/status`, {
            status: 'served' as ItemStatus,
          })
        )
      );
      // Optimistic removal — the order:status socket event will also fire
      // and would filter it out anyway, but don't make the runner wait on
      // the round trip for their own action to visibly register.
      setOrders((prev) => prev.filter((o) => o.id !== order.id));
      toast.success(`Delivered to ${order.destination || order.customerName}`);
      // Open payment dialog after successful delivery
      setPaymentOrder(order);
    } catch (error) {
      console.error('Failed to mark order delivered:', error);
      toast.error('Failed to mark delivered — still showing as ready');
    } finally {
      setPendingOrderIds((prev) => {
        const next = new Set(prev);
        next.delete(order.id);
        return next;
      });
    }
  };

  const handlePaymentComplete = () => {
    setPaymentOrder(null);
    loadOrders();
  };

  const groups = orders.reduce<Record<string, Order[]>>((acc, order) => {
    const key = order.destination || UNASSIGNED_LABEL;
    (acc[key] ??= []).push(order);
    return acc;
  }, {});
  const destinations = Object.keys(groups).sort((a, b) => {
    // Unassigned last — it's the group that most needs a human to notice
    // and fix at the source (no service_location_id on the order), not the
    // one a runner should be routed to first.
    if (a === UNASSIGNED_LABEL) return 1;
    if (b === UNASSIGNED_LABEL) return -1;
    return a.localeCompare(b);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <Truck className="h-8 w-8 text-primary" />
            {moduleName} Dispatch
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Waiting for hand-off, grouped by destination
          </p>
        </div>
        <Button variant="outline" size="icon" onClick={() => loadOrders()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </header>

      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-gray-400 dark:text-gray-600">
          <CheckCircle2 className="h-12 w-12 mb-3" />
          <p className="text-lg font-medium">Nothing waiting on dispatch</p>
        </div>
      ) : (
        <div className="space-y-8">
          {destinations.map((destination) => (
            <section key={destination}>
              <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-gray-500 dark:text-gray-400 mb-3">
                <MapPin className="h-4 w-4" />
                {destination}
                <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-gray-200 dark:bg-gray-800 text-gray-600 dark:text-gray-300">
                  {groups[destination].length}
                </span>
              </h2>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {groups[destination].map((order) => {
                  const isPending = pendingOrderIds.has(order.id);
                  const notes = order.items
                    .map((item) => item.specialInstructions)
                    .filter((note): note is string => Boolean(note));

                  return (
                    <div
                      key={order.id}
                      className="rounded-xl border border-green-300 dark:border-green-700 bg-white dark:bg-gray-800 shadow-sm overflow-hidden"
                    >
                      <div className="p-4 border-b border-gray-100 dark:border-gray-700">
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 text-sm font-semibold text-gray-800 dark:text-gray-100">
                            <User className="h-3.5 w-3.5 text-gray-400" />
                            {order.customerName}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-gray-400">
                            <Clock className="h-3 w-3" />
                            <ElapsedTimer since={order.createdAt} />
                          </div>
                        </div>
                        <p className="text-xs text-gray-400">
                          Order #{order.orderNumber ?? order.id.slice(0, 8)} · {formatCurrency(order.totalAmount)}
                        </p>
                      </div>

                      <div className="px-4 py-3 space-y-1">
                        {order.items.map((item) => (
                          <div key={item.id} className="text-sm text-gray-600 dark:text-gray-300">
                            <span className="font-medium">{item.quantity}x</span> {item.name}
                          </div>
                        ))}
                      </div>

                      {notes.length > 0 && (
                        <div className="px-4 pb-3 space-y-1">
                          {notes.map((note, i) => (
                            <p
                              key={i}
                              className="text-xs font-semibold text-yellow-800 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 px-2 py-1 rounded"
                            >
                              {note}
                            </p>
                          ))}
                        </div>
                      )}

                      <div className="p-3 bg-gray-50 dark:bg-gray-900/50">
                        <Button
                          className="w-full bg-emerald-600 hover:bg-emerald-700 text-white"
                          size="sm"
                          disabled={isPending}
                          onClick={() => markDelivered(order)}
                        >
                          {isPending ? 'Marking Delivered…' : 'Mark Delivered'}
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}

      {/* Payment Dialog */}
      {paymentOrder && (
        <PaymentDialog
          order={{
            id: paymentOrder.id,
            orderNumber: paymentOrder.orderNumber || paymentOrder.id.slice(0, 8),
            totalAmount: paymentOrder.totalAmount,
            items: paymentOrder.items.map(item => ({
              name: item.name,
              quantity: item.quantity,
            })),
          }}
          onClose={() => setPaymentOrder(null)}
          onComplete={handlePaymentComplete}
          slug={slug}
        />
      )}
    </div>
  );
}
