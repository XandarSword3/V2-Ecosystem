'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import { useSocket } from '@/lib/socket';
import {
  Cookie,
  Clock,
  CheckCircle2,
  ChefHat,
  Package,
  Truck,
  XCircle,
  RefreshCw,
  Bell,
  Search,
} from 'lucide-react';

interface SnackOrder {
  id: string;
  order_number: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'completed' | 'cancelled';
  total_amount: number;
  customer_name?: string;
  items: Array<{
    name: string;
    quantity: number;
    unit_price: number;
    notes?: string;
  }>;
  created_at: string;
}

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string; nextStatus?: string; nextLabel?: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock, label: 'Pending', nextStatus: 'preparing', nextLabel: 'Start Preparing' },
  confirmed: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle2, label: 'Confirmed', nextStatus: 'preparing', nextLabel: 'Start Preparing' },
  preparing: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: ChefHat, label: 'Preparing', nextStatus: 'ready', nextLabel: 'Mark Ready' },
  ready: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: Package, label: 'Ready', nextStatus: 'delivered', nextLabel: 'Delivered' },
  delivered: { color: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400', icon: Truck, label: 'Delivered', nextStatus: 'completed', nextLabel: 'Complete' },
  completed: { color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', icon: CheckCircle2, label: 'Completed' },
  cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Cancelled' },
};

export default function StaffSnackPage() {
  const [orders, setOrders] = useState<SnackOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'active' | 'all'>('active');
  const [searchQuery, setSearchQuery] = useState('');
  const { socket } = useSocket();

  const fetchOrders = useCallback(async () => {
    try {
      const response = await api.get('/snack/staff/orders/live');
      setOrders(response.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    // Refresh every 30 seconds
    const interval = setInterval(fetchOrders, 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Real-time updates
  useEffect(() => {
    if (socket) {
      socket.on('snack:order:new', (order: SnackOrder) => {
        setOrders((prev) => [order, ...prev]);
        toast.info(`New snack bar order: #${order.order_number || order.id.slice(0, 8)}`);
        // Play notification sound
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
      });

      socket.on('snack:order:updated', (order: SnackOrder) => {
        setOrders((prev) =>
          prev.map((o) => (o.id === order.id ? order : o))
        );
      });

      return () => {
        socket.off('snack:order:new');
        socket.off('snack:order:updated');
      };
    }
  }, [socket]);

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.patch(`/snack/staff/orders/${orderId}/status`, { status: newStatus });
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, status: newStatus as SnackOrder['status'] } : o))
      );
      toast.success(`Order updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update order');
    }
  };

  const filteredOrders = orders
    .filter((o) => {
      if (filter === 'active') {
        return !['completed', 'cancelled'].includes(o.status);
      }
      return true;
    })
    .filter((o) => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        return (
          o.id.toLowerCase().includes(query) ||
          o.order_number?.toLowerCase().includes(query) ||
          o.customer_name?.toLowerCase().includes(query)
        );
      }
      return true;
    });

  const pendingCount = orders.filter((o) => o.status === 'pending').length;
  const preparingCount = orders.filter((o) => o.status === 'preparing').length;
  const readyCount = orders.filter((o) => o.status === 'ready').length;

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Cookie className="w-7 h-7 text-orange-500" />
            Snack Bar Orders
          </h1>
          <p className="text-slate-500 dark:text-slate-400">
            Manage snack bar orders in real-time
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={fetchOrders}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4">
        <motion.div variants={fadeInUp}>
          <Card className="bg-gradient-to-br from-yellow-500 to-amber-500 text-white">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-yellow-100 text-sm">Pending</p>
                  <p className="text-3xl font-bold">{pendingCount}</p>
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
                  <p className="text-3xl font-bold">{preparingCount}</p>
                </div>
                <ChefHat className="w-10 h-10 text-orange-200" />
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
                  <p className="text-3xl font-bold">{readyCount}</p>
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
            <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setFilter('active')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'active'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                Active Orders
              </button>
              <button
                onClick={() => setFilter('all')}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-white dark:bg-slate-700 text-slate-900 dark:text-white shadow'
                    : 'text-slate-600 dark:text-slate-400'
                }`}
              >
                All Orders
              </button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredOrders.length === 0 ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="col-span-full text-center py-12"
            >
              <Cookie className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No orders to display</p>
            </motion.div>
          ) : (
            filteredOrders.map((order, index) => {
              const config = statusConfig[order.status];
              const StatusIcon = config?.icon || Clock;

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  layout
                >
                  <Card className={`hover:shadow-lg transition-all ${
                    order.status === 'pending' ? 'ring-2 ring-yellow-400 animate-pulse' : ''
                  }`}>
                    <CardHeader className="pb-2">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg flex items-center gap-2">
                          <Cookie className="w-5 h-5 text-orange-500" />
                          #{order.order_number || order.id.slice(0, 8)}
                        </CardTitle>
                        <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium ${config?.color}`}>
                          <StatusIcon className="w-3 h-3" />
                          {config?.label}
                        </span>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {order.customer_name && (
                        <p className="text-sm text-slate-600 dark:text-slate-300">
                          Customer: {order.customer_name}
                        </p>
                      )}

                      {/* Items */}
                      <div className="space-y-1 max-h-32 overflow-y-auto">
                        {order.items?.map((item, i) => (
                          <div key={i} className="flex justify-between text-sm">
                            <span className="text-slate-700 dark:text-slate-300">
                              {item.quantity}x {item.name}
                            </span>
                          </div>
                        ))}
                      </div>

                      {/* Total */}
                      <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                        <span className="text-slate-600 dark:text-slate-400">Total</span>
                        <span className="font-bold text-slate-900 dark:text-white">
                          {formatCurrency(order.total_amount)}
                        </span>
                      </div>

                      {/* Action Button */}
                      {config?.nextStatus && (
                        <Button
                          className="w-full"
                          onClick={() => updateOrderStatus(order.id, config.nextStatus!)}
                        >
                          {config.nextLabel}
                        </Button>
                      )}

                      {/* Time */}
                      <p className="text-xs text-slate-400 text-center">
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
    </motion.div>
  );
}
