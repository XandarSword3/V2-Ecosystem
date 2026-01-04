'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { useSocket } from '@/lib/socket';
import {
  Clock,
  CheckCircle2,
  XCircle,
  Cookie,
  RefreshCw,
  Search,
  Timer,
  User,
} from 'lucide-react';

interface OrderItem {
  id: string;
  quantity: number;
  unit_price: number;
  notes?: string;
  name: string; // Backend returns 'name' directly
}

interface Order {
  id: string;
  order_number: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
  total_amount: number;
  notes?: string;
  created_at: string;
  items?: OrderItem[]; // Backend returns 'items'
  users?: {
    full_name: string;
  };
}

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock, label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle2, label: 'Confirmed' },
  preparing: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: Cookie, label: 'Preparing' },
  ready: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2, label: 'Ready' },
  delivered: { color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', icon: CheckCircle2, label: 'Delivered' },
  cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Cancelled' },
};

export default function AdminSnackOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { socket } = useSocket();

  const fetchOrders = useCallback(async () => {
    try {
      const response = await api.get('/snack/staff/orders');
      setOrders(response.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useEffect(() => {
    if (socket) {
      socket.on('snack:order:new', (order: Order) => {
        setOrders((prev) => [order, ...prev]);
        toast.success(`New snack order #${order.order_number}`);
      });

      socket.on('snack:order:updated', (order: Order) => {
        setOrders((prev) => prev.map((o) => (o.id === order.id ? order : o)));
      });

      return () => {
        socket.off('snack:order:new');
        socket.off('snack:order:updated');
      };
    }
  }, [socket]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.patch(`/snack/staff/orders/${orderId}/status`, { status });
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status: status as Order['status'] } : o)));
      toast.success('Order status updated');
    } catch (error) {
      toast.error('Failed to update order');
    }
  };

  const filteredOrders = orders.filter((o) => {
    if (statusFilter !== 'all' && o.status !== statusFilter) return false;
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return o.order_number.toLowerCase().includes(query) || o.users?.full_name?.toLowerCase().includes(query);
    }
    return true;
  });

  const stats = {
    pending: orders.filter((o) => o.status === 'pending').length,
    preparing: orders.filter((o) => o.status === 'preparing').length,
    ready: orders.filter((o) => o.status === 'ready').length,
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Snack Bar Orders</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage poolside snack orders</p>
        </div>
        <Button variant="outline" onClick={fetchOrders}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-yellow-500 to-orange-500 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100 text-sm">Pending</p>
                  <p className="text-3xl font-bold">{stats.pending}</p>
                </div>
                <Clock className="w-10 h-10 text-yellow-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-orange-500 to-red-500 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-orange-100 text-sm">Preparing</p>
                  <p className="text-3xl font-bold">{stats.preparing}</p>
                </div>
                <Cookie className="w-10 h-10 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-green-500 to-emerald-500 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-green-100 text-sm">Ready</p>
                  <p className="text-3xl font-bold">{stats.ready}</p>
                </div>
                <CheckCircle2 className="w-10 h-10 text-green-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search orders..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
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
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Orders */}
      <div className="space-y-4">
        <AnimatePresence mode="popLayout">
          {filteredOrders.length === 0 ? (
            <div className="text-center py-12">
              <Cookie className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No snack orders found</p>
            </div>
          ) : (
            filteredOrders.map((order, index) => {
              const config = statusConfig[order.status];
              const StatusIcon = config?.icon || Clock;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, x: -100 }}
                  transition={{ delay: index * 0.03 }}
                  layout
                >
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex flex-col lg:flex-row lg:items-center gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-mono font-bold text-lg text-slate-900 dark:text-white">
                              #{order.order_number}
                            </span>
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config?.color}`}>
                              <StatusIcon className="w-3 h-3" />
                              {config?.label}
                            </span>
                          </div>

                          <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                            {order.items?.map((item) => (
                              <p key={item.id}>
                                {item.quantity}x {item.name}
                              </p>
                            ))}
                          </div>

                          <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                            <span className="flex items-center gap-1">
                              <Timer className="w-3 h-3" />
                              {formatDate(order.created_at)}
                            </span>
                            {order.users && (
                              <span className="flex items-center gap-1">
                                <User className="w-3 h-3" />
                                {order.users.full_name}
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-col items-end gap-2">
                          <p className="text-xl font-bold text-slate-900 dark:text-white">
                            {formatCurrency(order.total_amount)}
                          </p>
                          <div className="flex gap-2">
                            {order.status === 'pending' && (
                              <Button size="sm" onClick={() => updateOrderStatus(order.id, 'preparing')}>
                                Start Preparing
                              </Button>
                            )}
                            {order.status === 'preparing' && (
                              <Button size="sm" onClick={() => updateOrderStatus(order.id, 'ready')}>
                                Mark Ready
                              </Button>
                            )}
                            {order.status === 'ready' && (
                              <Button size="sm" onClick={() => updateOrderStatus(order.id, 'delivered')}>
                                Mark Delivered
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
