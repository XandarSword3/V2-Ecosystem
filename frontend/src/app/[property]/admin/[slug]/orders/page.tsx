'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useAuthorization, Perm } from '@/lib/authorization';
import { useSiteSettings } from '@/lib/settings-context';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { useSocket } from '@/lib/socket';
// Canonical Engine A domain helpers (plan F1): the page keys off the
// canonical fulfillment state — never legacy composites (preparing /
// delivered) and never fulfillment inferred from transactions.status.
import { canonicalFulfillmentState, FULFILLMENT_LAYER_STATES, type CanonicalOrderState, type FulfillmentMode, type FulfillmentState } from '@/types';
import { getModeStateConfig, resolveColumnKey } from '@/lib/engine-a/types';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  Search,
  Package,
  Timer,
  User,
} from 'lucide-react';

interface SocketOrderEvent {
  id?: string;
  orderId?: string;
  orderNumber?: string;
  order_number?: string;
  moduleId?: string;
  module_id?: string;
  status?: Order['status'];
}

interface OrderItem {
  id: string;
  catalog_item_id?: string;
  quantity: number;
  unit_price?: number;
  unitPrice?: number;
  notes?: string;
  special_instructions?: string;
  specialInstructions?: string;
  name?: string;
  catalog_items?: {
    name: string;
  };
}

interface Order {
  id: string;
  order_number: string;
  orderNumber?: string;
  // Transaction layer only — fulfillment is NEVER inferred from status.
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  /** Stage 6 canonical fulfillment state (queued/in_progress/ready/handed_off). */
  fulfillment_status?: string | null;
  fulfillmentStatus?: string | null;
  /** Phase F1: which fulfillment mode governs this order's states. */
  fulfillmentMode?: string | null;
  total_amount: number;
  totalAmount?: number;
  table_number?: number;
  tableNumber?: number;
  notes?: string;
  created_at: string;
  createdAt?: string;
  order_items?: OrderItem[];
  items?: OrderItem[];
  users?: {
    full_name: string;
  };
  customer?: {
    full_name: string;
  };
  customerName?: string;
}

// Canonical state presentation — neutral labels, no vertical vocabulary.
const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock, label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle2, label: 'Confirmed' },
  queued: { color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400', icon: Clock, label: 'Queued' },
  in_progress: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: Loader2, label: 'In Progress' },
  ready: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2, label: 'Ready' },
  handed_off: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: CheckCircle2, label: 'Handed Off' },
  completed: { color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', icon: CheckCircle2, label: 'Completed' },
  cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Cancelled' },
};

/** Canonical state for board/action purposes — a confirmed transaction
 * whose fulfillment is queued (or not yet created) displays as the mode's
 * first column state. */
function effectiveState(order: Order): string {
  const mode = (order.fulfillmentMode as FulfillmentMode | null) ?? null;
  const c = canonicalFulfillmentState(order, mode);
  const cfg = getModeStateConfig(mode);
  return resolveColumnKey(c, cfg);
}

/** Canonical filter list — transaction states + fulfillment states. */
// All possible filter states across all fulfillment modes + transaction layer
const FILTER_STATES = [
  'all',
  'pending', 'confirmed', 'completed', 'cancelled',
  'queued', 'in_progress', 'ready', 'handed_off',
  'provisioning', 'provisioned', 'delivered',
  'allocated', 'picking', 'packed', 'shipped', 'in_transit',
  'received', 'working', 'collected',
];

export default function DynamicOrdersPage() {
  const params = useParams();
  const { modules } = useSiteSettings();
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentModule = modules.find(m => m.slug === slug);

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { socket } = useSocket();
  const auth = useAuthorization(); // F2: permission-aware rendering

  const fetchOrders = useCallback(async () => {
    if (!currentModule) return;
    try {
      const response = await api.get(`/${slug}/orders`, {
        params: { moduleId: currentModule.id }
      });
      setOrders(response.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [currentModule, slug]);

  useEffect(() => {
    if (currentModule) {
      fetchOrders();
    }
  }, [fetchOrders, currentModule]);

  useEffect(() => {
    if (socket && currentModule) {
      socket.on('order:new', (order: SocketOrderEvent) => {
        if (order.moduleId === currentModule.id || order.module_id === currentModule.id) {
          fetchOrders();
          toast.success(`New order #${order.orderNumber || order.order_number}`);
        }
      });

      socket.on('order:updated', (order: SocketOrderEvent) => {
        if (order.moduleId === currentModule.id || order.module_id === currentModule.id) {
          setOrders((prev) => prev.map((o) => (o.id === order.orderId || o.id === order.id ? { ...o, ...order } as Order : o)));
        }
      });
    }

    return () => {
      if (socket) {
        socket.off('order:new');
        socket.off('order:updated');
      }
    };
  }, [socket, fetchOrders, currentModule]);

  // Canonical transitions only. Fulfillment-layer targets update the
  // canonical fulfillment state; transaction-layer targets update status.
  const updateStatus = async (orderId: string, target: CanonicalOrderState) => {
    try {
      await api.put(`/staff/modules/${slug}/orders/${orderId}/status`, { status: target });
      toast.success(`Order updated to ${target}`);
      fetchOrders();
      if (selectedOrder?.id === orderId) {
        setSelectedOrder((prev) =>
          prev
            ? FULFILLMENT_LAYER_STATES.includes(target as never)
              ? { ...prev, fulfillment_status: target }
              : { ...prev, status: target as Order['status'] }
            : null
        );
      }
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const filteredOrders = orders.filter((order) => {
    const matchesStatus = statusFilter === 'all' || effectiveState(order) === statusFilter;
    const matchesSearch =
      (order.order_number || order.orderNumber || '').toLowerCase().includes(searchQuery.toLowerCase()) ||
      (order.customer?.full_name || order.customerName || '').toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  if (!currentModule) return null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Package className="w-6 h-6 text-white" />
            </div>
            {currentModule.name} Orders
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">
            Manage incoming orders for {currentModule.name}
          </p>
        </div>
        <Button onClick={() => fetchOrders()} variant="outline" className="gap-2">
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
              <input
                type="text"
                placeholder="Search by order # or customer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 focus:ring-2 focus:ring-blue-500 outline-none transition-all"
              />
            </div>
            <div className="flex gap-2 overflow-x-auto pb-2 md:pb-0">
              {FILTER_STATES.map((status) => (
                <button
                  key={status}
                  onClick={() => setStatusFilter(status)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${statusFilter === status
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                >
                  {status.charAt(0).toUpperCase() + status.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        <AnimatePresence mode="popLayout">
          {loading ? (
            [...Array(6)].map((_, i) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <CardSkeleton />
              </motion.div>
            ))
          ) : filteredOrders.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <div className="w-16 h-16 bg-slate-100 dark:bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4">
                <Package className="w-8 h-8 text-slate-400" />
              </div>
              <h3 className="text-lg font-medium text-slate-900 dark:text-white">No orders found</h3>
              <p className="text-slate-500 dark:text-slate-400">
                {searchQuery || statusFilter !== 'all'
                  ? 'Try adjusting your filters'
                  : 'New orders will appear here'}
              </p>
            </div>
          ) : (
            filteredOrders.map((order) => {
              const st = effectiveState(order);
              const StatusIcon = statusConfig[st]?.icon || Clock;
              const items = order.items || order.order_items || [];

              return (
                <motion.div
                  key={order.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.2 }}
                >
                  <Card className="h-full hover:shadow-md transition-shadow border-l-4" style={{ borderLeftColor: st === 'pending' ? '#eab308' : st === 'ready' ? '#22c55e' : 'transparent' }}>
                    <CardContent className="p-5 space-y-4">
                      {/* Header */}
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center gap-2 mb-1">
                            <span className="font-mono font-bold text-lg">
                              #{order.order_number || order.orderNumber}
                            </span>
                            <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium flex items-center gap-1 ${statusConfig[st]?.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {statusConfig[st]?.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                            <User className="w-3 h-3" />
                            {order.customer?.full_name || order.customerName || 'Guest'}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-bold text-lg text-slate-900 dark:text-white">
                            {formatCurrency(order.total_amount || order.totalAmount || 0)}
                          </div>
                          <div className="flex items-center gap-1 text-xs text-slate-500 justify-end">
                            <Timer className="w-3 h-3" />
                            {formatDate(order.created_at || order.createdAt || '')}
                          </div>
                        </div>
                      </div>

                      {/* Items */}
                      <div className="py-3 border-t border-b border-slate-100 dark:border-slate-800 space-y-2">
                        {items.slice(0, 3).map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <div className="flex gap-2">
                              <span className="font-medium text-slate-900 dark:text-white">
                                {item.quantity}x
                              </span>
                              <span className="text-slate-600 dark:text-slate-400">
                                {item.catalog_items?.name || item.name}
                              </span>
                            </div>
                            <span className="text-slate-500">
                              {formatCurrency((item.unit_price || item.unitPrice || 0) * item.quantity)}
                            </span>
                          </div>
                        ))}
                        {items.length > 3 && (
                          <p className="text-xs text-center text-slate-500 italic">
                            + {items.length - 3} more items
                          </p>
                        )}
                      </div>

                      {/* Actions — canonical transitions, one step at a time.
                          pending→confirmed is a transaction-layer move;
                          queued→in_progress→ready→handed_off→completed are
                          fulfillment-layer moves. */}
                      {/* Actions — mode-derived transitions from getModeStateConfig.
                          pending/confirmed → transaction-layer confirm.
                          fulfillment states → derive next target from mode config.
                          No hardcoded hospitality action arrays. */}
                      <div className="grid grid-cols-2 gap-2 pt-2">
                        {(() => {
                          // F2: only show order actions if user has order:update permission
                          if (!auth.hasPermission(Perm.ORDER_UPDATE)) return null;
                          const mode = (order.fulfillmentMode as FulfillmentMode | null) ?? null;
                          const cs = canonicalFulfillmentState(order, mode);
                          // Transaction-layer: pending → confirmed
                          if (cs === 'pending') {
                            return (
                              <>
                                <Button
                                  variant="outline"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                                  onClick={() => updateStatus(order.id, 'cancelled')}
                                >
                                  Reject
                                </Button>
                                <Button
                                  className="bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => updateStatus(order.id, 'confirmed')}
                                >
                                  Accept
                                </Button>
                              </>
                            );
                          }
                          // Fulfillment-layer: derive next target from mode config
                          const cfg = getModeStateConfig(mode);
                          if (cfg && cs) {
                            const nextState = cfg.nextTarget(cs as FulfillmentState);
                            if (nextState) {
                              const meta = cfg.metadata[cs as FulfillmentState];
                              return (
                                <Button
                                  className="col-span-2 bg-blue-600 hover:bg-blue-700 text-white"
                                  onClick={() => updateStatus(order.id, nextState)}
                                >
                                  {meta?.actionLabel ?? nextState}
                                </Button>
                              );
                            }
                          }
                          return null;
                        })()}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
