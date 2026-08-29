'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { useSocket } from '@/lib/socket';
// Canonical Engine A domain helpers (plan F1): the page keys off the
// canonical fulfillment state — never legacy composites and never
// fulfillment inferred from transactions.status.
import { canonicalFulfillmentState, FULFILLMENT_LAYER_STATES, type CanonicalOrderState, type FulfillmentMode, type FulfillmentState } from '@/types';
import { getModeStateConfig, resolveColumnKey } from '@/lib/engine-a/types';
import {
  Search,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  Loader2,
  Truck,
  Package,
  AlertCircle,
  Play,
  Eye,
} from 'lucide-react';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unit_price: number;
  notes?: string;
}

interface Order {
  id: string;
  order_number: string;
  module_slug: string;
  module_name: string;
  // Transaction layer only — fulfillment is NEVER inferred from status.
  status: 'pending' | 'confirmed' | 'completed' | 'cancelled';
  /** Stage 6 canonical fulfillment state (mode-specific). */
  fulfillmentStatus?: string | null;
  /** Which fulfillment mode governs this order's states. */
  fulfillmentMode?: string | null;
  total_amount: number;
  items: OrderItem[];
  table_number?: string;
  customer_name?: string;
  customer_notes?: string;
  created_at: string;
  updated_at: string;
}

// Canonical state presentation — neutral labels, no vertical vocabulary.
const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock, label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle2, label: 'Confirmed' },
  queued: { color: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900/30 dark:text-indigo-400', icon: Clock, label: 'Queued' },
  in_progress: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: Loader2, label: 'In Progress' },
  ready: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: Package, label: 'Ready' },
  handed_off: { color: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400', icon: Truck, label: 'Handed Off' },
  completed: { color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', icon: CheckCircle2, label: 'Completed' },
  cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Cancelled' },
};

/** Canonical state for display/action purposes — a confirmed transaction
 * whose fulfillment is queued (or not yet created) displays as the mode's
 * first column state. */
function effectiveState(order: Order): string {
  const mode = (order.fulfillmentMode as FulfillmentMode | null) ?? null;
  const c = canonicalFulfillmentState(order, mode);
  const cfg = getModeStateConfig(mode);
  return resolveColumnKey(c, cfg);
}

// All possible filter states across all fulfillment modes + transaction layer
const FILTER_STATES = [
  'all',
  // Transaction layer
  'pending', 'confirmed', 'completed', 'cancelled',
  // Hospitality
  'queued', 'in_progress', 'ready', 'handed_off',
  // Digital
  'provisioning', 'provisioned', 'delivered',
  // Shipment
  'allocated', 'picking', 'packed', 'shipped', 'in_transit',
  // Service
  'received', 'working', 'collected',
];

export default function AdminOrdersPage() {
  const t = useTranslations('admin');
  const [orders, setOrders] = useState<Order[]>([]);
  const [modules, setModules] = useState<Array<{ slug: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { socket } = useSocket();

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);

      // Discover all active instant_transaction modules
      const modsRes = await api.get('/admin/modules').catch(() => ({ data: { data: [] } }));
      const allMods: Array<{ id: string; slug: string; name: string; engine_type?: string; template_type?: string }> =
        modsRes.data?.data || [];
      const instantMods = allMods.filter(
        m => m.engine_type === 'instant_transaction' || m.template_type === 'menu_service'
      );
      setModules(instantMods.map(m => ({ slug: m.slug, name: m.name })));

      // Fetch orders for each module in parallel
      const orderResponses = await Promise.all(
        instantMods.map(m =>
          api.get(`/staff/modules/${m.slug}/orders`).catch(() => ({ data: { data: [] } }))
        )
      );

      const allOrders = orderResponses.flatMap((res, i) =>
        (res.data?.data || res.data || []).map((o: Omit<Order, 'module_slug' | 'module_name'>) => ({
          ...o,
          module_slug: instantMods[i].slug,
          module_name: instantMods[i].name,
        }))
      );

      setOrders(
        allOrders.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      );
    } catch (error) {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  // Real-time order updates
  useEffect(() => {
    if (socket) {
      socket.on('order:new', (order: Order) => {
        setOrders((prev) => [order, ...prev]);
        toast.success(`New order received: #${order.order_number || order.id.slice(0, 8)}`);
      });

      socket.on('order:updated', (order: Partial<Order> & { id: string }) => {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, ...order } : o))
        );
      });

      socket.on('order:statusChanged', ({ orderId, status, fulfillmentStatus }: { orderId: string; status: string; fulfillmentStatus?: string | null }) => {
        setOrders((prev) =>
          prev.map((o) =>
            o.id === orderId
              ? {
                  ...o,
                  ...(FULFILLMENT_LAYER_STATES.includes(status as never)
                    ? { fulfillmentStatus: status }
                    : { status: status as Order['status'] }),
                  ...(fulfillmentStatus ? { fulfillmentStatus } : {}),
                }
              : o
          )
        );
      });

      return () => {
        socket.off('order:new');
        socket.off('order:updated');
        socket.off('order:statusChanged');
      };
    }
  }, [socket]);

  // Canonical transitions only. Fulfillment-layer targets update the
  // canonical fulfillment state; transaction-layer targets update status.
  const updateOrderStatus = async (orderId: string, moduleSlug: string, target: CanonicalOrderState) => {
    try {
      await api.put(`/staff/modules/${moduleSlug}/orders/${orderId}/status`, { status: target });

      setOrders((prev) =>
        prev.map((o) =>
          o.id === orderId
            ? FULFILLMENT_LAYER_STATES.includes(target as never)
              ? { ...o, fulfillmentStatus: target }
              : { ...o, status: target as Order['status'] }
            : o
        )
      );

      toast.success('Order status updated');
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && effectiveState(o) !== statusFilter) return false;
    if (sourceFilter !== 'all' && o.module_slug !== sourceFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        o.id.toLowerCase().includes(query) ||
        o.order_number?.toLowerCase().includes(query) ||
        o.customer_name?.toLowerCase().includes(query) ||
        o.table_number?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const activeOrders = orders.filter((o) => !['completed', 'cancelled'].includes(o.status));
  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const inProgressCount = orders.filter((o) => effectiveState(o) === 'in_progress').length;
  const readyCount = orders.filter((o) => effectiveState(o) === 'ready').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <motion.div
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
            Orders
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Manage orders across all active transaction modules in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => fetchOrders()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-blue-500 to-blue-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-blue-100 text-sm">Active Orders</p>
                  <p className="text-2xl font-bold mt-1">{activeOrders.length}</p>
                </div>
                <Package className="w-10 h-10 text-blue-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-yellow-500 to-yellow-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100 text-sm">Pending</p>
                  <p className="text-2xl font-bold mt-1">{pendingCount}</p>
                </div>
                <Clock className="w-10 h-10 text-yellow-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-orange-500 to-orange-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">In Progress</p>
                  <p className="text-2xl font-bold mt-1">{inProgressCount}</p>
                </div>
                <Loader2 className="w-10 h-10 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-green-500 to-green-600 text-white">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Ready</p>
                  <p className="text-2xl font-bold mt-1">{readyCount}</p>
                </div>
                <Package className="w-10 h-10 text-green-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search by order ID, customer, or table..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Source Filter */}
            <select
              value={sourceFilter}
              onChange={(e) => setSourceFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Modules</option>
              {modules.map(m => (
                <option key={m.slug} value={m.slug}>{m.name}</option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Status</option>
              {FILTER_STATES.filter((s) => s !== 'all').map((s) => (
                <option key={s} value={s}>{s.replace(/_/g, ' ').replace(/^./, (c) => c.toUpperCase())}</option>
              ))}
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredOrders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full text-center py-12"
            >
              <p className="text-slate-500 dark:text-slate-400">No orders found</p>
            </motion.div>
          ) : (
            filteredOrders.map((order, index) => {
              const st = effectiveState(order);
              const StatusIcon = statusConfig[st]?.icon || Clock;
              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                >
                  <Card className="hover:shadow-lg transition-shadow">
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <Package className="w-5 h-5 text-blue-500" />
                          <CardTitle className="text-lg">
                            #{order.order_number || order.id.slice(0, 8)}
                          </CardTitle>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            statusConfig[st]?.color
                          }`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig[st]?.label || st}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Customer Info */}
                      {(order.customer_name || order.table_number) && (
                        <div className="text-sm text-slate-600 dark:text-slate-300">
                          {order.customer_name && <p>Customer: {order.customer_name}</p>}
                          {order.table_number && <p>Table: {order.table_number}</p>}
                        </div>
                      )}

                      {/* Items */}
                      <div className="space-y-1">
                        {(order.items || []).slice(0, 3).map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-slate-600 dark:text-slate-300">
                              {item.quantity}x {item.name}
                            </span>
                            <span className="text-slate-500 dark:text-slate-400">
                              {formatCurrency(item.unit_price * item.quantity)}
                            </span>
                          </div>
                        ))}
                        {(order.items || []).length > 3 && (
                          <p className="text-xs text-slate-400">
                            +{order.items.length - 3} more items
                          </p>
                        )}
                      </div>

                      {/* Total */}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          Total
                        </span>
                        <span className="font-bold text-lg text-slate-900 dark:text-white">
                          {formatCurrency(order.total_amount)}
                        </span>
                      </div>

                      {/* Actions — mode-derived transitions, one step at a time.
                          pending→confirmed is a transaction-layer move;
                          fulfillment-layer moves are derived from the order's
                          fulfillmentMode via getModeStateConfig. */}
                      <div className="flex gap-2 pt-2">
                        {(() => {
                          const mode = (order.fulfillmentMode as FulfillmentMode | null) ?? null;
                          const cfg = getModeStateConfig(mode);
                          const cs = canonicalFulfillmentState(order, order.fulfillmentMode);
                          // Transaction-layer: pending → confirmed
                          if (cs === 'pending' || (!cs && st === 'pending')) {
                            return (
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => updateOrderStatus(order.id, order.module_slug, 'confirmed')}
                              >
                                <CheckCircle2 className="w-4 h-4 mr-1" />
                                Confirm
                              </Button>
                            );
                          }
                          // Fulfillment-layer: derive next target from mode config
                          if (cfg && cs) {
                            const nextState = cfg.nextTarget(cs as FulfillmentState);
                            if (nextState) {
                              const meta = cfg.metadata[cs as FulfillmentState];
                              return (
                                <Button
                                  size="sm"
                                  className="flex-1"
                                  onClick={() => updateOrderStatus(order.id, order.module_slug, nextState)}
                                >
                                  <Play className="w-4 h-4 mr-1" />
                                  {meta?.actionLabel ?? nextState}
                                </Button>
                              );
                            }
                          }
                          // No legacy fallback — mode config above drives all actions.
                          return null;
                        })()}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setSelectedOrder(order)}
                        >
                          <Eye className="w-4 h-4" />
                        </Button>
                      </div>

                      {/* Timestamp */}
                      <p className="text-xs text-slate-400 text-right">
                        {formatDate(order.created_at)}
                      </p>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>

      {/* Order Detail Modal */}
      <AnimatePresence>
        {selectedOrder && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200] p-4"
            onClick={() => setSelectedOrder(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white dark:bg-slate-800 rounded-xl max-w-lg w-full p-6 max-h-[80vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Order #{selectedOrder.order_number || selectedOrder.id.slice(0, 8)}
                </h2>
                <Button variant="ghost" size="sm" onClick={() => setSelectedOrder(null)}>
                  ×
                </Button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                  <span className="text-slate-500 dark:text-slate-400">Module</span>
                  <p className="font-medium text-slate-900 dark:text-white capitalize">
                  {selectedOrder.module_name}
                  </p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Status</span>
                    <p className="font-medium text-slate-900 dark:text-white capitalize">
                      {effectiveState(selectedOrder)}
                    </p>
                  </div>
                  {selectedOrder.customer_name && (
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Customer</span>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {selectedOrder.customer_name}
                      </p>
                    </div>
                  )}
                  {selectedOrder.table_number && (
                    <div>
                      <span className="text-slate-500 dark:text-slate-400">Table</span>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {selectedOrder.table_number}
                      </p>
                    </div>
                  )}
                </div>

                <div className="border-t border-slate-200 dark:border-slate-700 pt-4">
                  <h3 className="font-medium text-slate-900 dark:text-white mb-2">Items</h3>
                  <div className="space-y-2">
                    {(selectedOrder.items || []).map((item, i) => (
                      <div key={i} className="flex justify-between">
                        <span className="text-slate-600 dark:text-slate-300">
                          {item.quantity}x {item.name}
                          {item.notes && (
                            <span className="text-xs text-slate-400 block">
                              Note: {item.notes}
                            </span>
                          )}
                        </span>
                        <span className="font-medium text-slate-900 dark:text-white">
                          {formatCurrency(item.unit_price * item.quantity)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedOrder.customer_notes && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>Notes:</strong> {selectedOrder.customer_notes}
                    </p>
                  </div>
                )}

                <div className="border-t border-slate-200 dark:border-slate-700 pt-4 flex justify-between items-center">
                  <span className="text-lg font-medium text-slate-900 dark:text-white">
                    Total
                  </span>
                  <span className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(selectedOrder.total_amount)}
                  </span>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
