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
import {
  UtensilsCrossed,
  Cookie,
  Search,
  Filter,
  RefreshCw,
  CheckCircle2,
  Clock,
  XCircle,
  ChefHat,
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
  source: 'restaurant' | 'snack_bar';
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled';
  total_amount: number;
  items: OrderItem[];
  table_number?: string;
  customer_name?: string;
  customer_notes?: string;
  created_at: string;
  updated_at: string;
}

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock, label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle2, label: 'Confirmed' },
  preparing: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: ChefHat, label: 'Preparing' },
  ready: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: Package, label: 'Ready' },
  delivered: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Truck, label: 'Delivered' },
  completed: { color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', icon: CheckCircle2, label: 'Completed' },
  cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Cancelled' },
};

export default function AdminOrdersPage() {
  const t = useTranslations('admin');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { socket } = useSocket();

  const fetchOrders = useCallback(async () => {
    try {
      setLoading(true);
      // Fetch both restaurant and snack bar orders
      const [restaurantRes, snackRes] = await Promise.all([
        api.get('/restaurant/admin/orders').catch(() => ({ data: { data: [] } })),
        api.get('/snack/staff/orders').catch(() => ({ data: { data: [] } })),
      ]);

      const restaurantOrders = (restaurantRes.data.data || []).map((o: any) => ({
        ...o,
        source: 'restaurant',
      }));
      const snackOrders = (snackRes.data.data || []).map((o: any) => ({
        ...o,
        source: 'snack_bar',
      }));

      // Combine and sort by date
      const allOrders = [...restaurantOrders, ...snackOrders].sort(
        (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
      );

      setOrders(allOrders);
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
      socket.on('order:new', (order: any) => {
        setOrders((prev) => [order, ...prev]);
        toast.success(`New order received: #${order.order_number || order.id.slice(0, 8)}`);
      });

      socket.on('order:updated', (order: any) => {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? { ...o, ...order } : o))
        );
      });

      socket.on('order:statusChanged', ({ orderId, status }: { orderId: string; status: string }) => {
        setOrders((prev) =>
          prev.map((o) => (o.id === orderId ? { ...o, status: status as Order['status'] } : o))
        );
      });

      return () => {
        socket.off('order:new');
        socket.off('order:updated');
        socket.off('order:statusChanged');
      };
    }
  }, [socket]);

  const updateOrderStatus = async (orderId: string, source: string, newStatus: string) => {
    try {
      const endpoint = source === 'restaurant' 
        ? `/restaurant/admin/orders/${orderId}/status`
        : `/snack/staff/orders/${orderId}/status`;
      
      await api.put(endpoint, { status: newStatus });
      
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as Order['status'] } : o))
      );
      
      toast.success('Order status updated');
    } catch (error) {
      toast.error('Failed to update order status');
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (sourceFilter !== 'all' && o.source !== sourceFilter) return false;
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
  const preparingCount = orders.filter((o) => o.status === 'preparing').length;
  const readyCount = orders.filter((o) => o.status === 'ready').length;

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
            Manage restaurant and snack bar orders in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchOrders}>
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
                <UtensilsCrossed className="w-10 h-10 text-blue-200" />
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
                  <p className="text-orange-100 text-sm">Preparing</p>
                  <p className="text-2xl font-bold mt-1">{preparingCount}</p>
                </div>
                <ChefHat className="w-10 h-10 text-orange-200" />
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
              <option value="all">All Sources</option>
              <option value="restaurant">Restaurant</option>
              <option value="snack_bar">Snack Bar</option>
            </select>

            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            >
              <option value="all">All Status</option>
              <option value="pending">Pending</option>
              <option value="confirmed">Confirmed</option>
              <option value="preparing">Preparing</option>
              <option value="ready">Ready</option>
              <option value="delivered">Delivered</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
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
              const StatusIcon = statusConfig[order.status]?.icon || Clock;
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
                          {order.source === 'restaurant' ? (
                            <UtensilsCrossed className="w-5 h-5 text-blue-500" />
                          ) : (
                            <Cookie className="w-5 h-5 text-orange-500" />
                          )}
                          <CardTitle className="text-lg">
                            #{order.order_number || order.id.slice(0, 8)}
                          </CardTitle>
                        </div>
                        <span
                          className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            statusConfig[order.status]?.color
                          }`}
                        >
                          <StatusIcon className="w-3 h-3" />
                          {statusConfig[order.status]?.label || order.status}
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

                      {/* Actions */}
                      <div className="flex gap-2 pt-2">
                        {order.status === 'pending' && (
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => updateOrderStatus(order.id, order.source, 'confirmed')}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Confirm
                          </Button>
                        )}
                        {order.status === 'confirmed' && (
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => updateOrderStatus(order.id, order.source, 'preparing')}
                          >
                            <ChefHat className="w-4 h-4 mr-1" />
                            Start
                          </Button>
                        )}
                        {order.status === 'preparing' && (
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => updateOrderStatus(order.id, order.source, 'ready')}
                          >
                            <Package className="w-4 h-4 mr-1" />
                            Ready
                          </Button>
                        )}
                        {order.status === 'ready' && (
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => updateOrderStatus(order.id, order.source, 'delivered')}
                          >
                            <Truck className="w-4 h-4 mr-1" />
                            Deliver
                          </Button>
                        )}
                        {order.status === 'delivered' && (
                          <Button
                            size="sm"
                            className="flex-1"
                            onClick={() => updateOrderStatus(order.id, order.source, 'completed')}
                          >
                            <CheckCircle2 className="w-4 h-4 mr-1" />
                            Complete
                          </Button>
                        )}
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
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
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
                    <span className="text-slate-500 dark:text-slate-400">Source</span>
                    <p className="font-medium text-slate-900 dark:text-white capitalize">
                      {selectedOrder.source.replace('_', ' ')}
                    </p>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Status</span>
                    <p className="font-medium text-slate-900 dark:text-white capitalize">
                      {selectedOrder.status}
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
