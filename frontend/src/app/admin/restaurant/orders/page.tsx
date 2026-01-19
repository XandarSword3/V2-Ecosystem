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
  ChefHat,
  RefreshCw,
  Search,
  UtensilsCrossed,
  Timer,
  User,
} from 'lucide-react';

interface OrderItem {
  id: string;
  menu_item_id?: string;
  quantity: number;
  unit_price?: number;
  unitPrice?: number;
  notes?: string;
  special_instructions?: string;
  specialInstructions?: string;
  name?: string;
  menu_items?: {
    name: string;
  };
}

interface Order {
  id: string;
  order_number: string;
  orderNumber?: string;
  status: 'pending' | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled';
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

const statusConfig: Record<string, { color: string; icon: React.ElementType; label: string }> = {
  pending: { color: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400', icon: Clock, label: 'Pending' },
  confirmed: { color: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400', icon: CheckCircle2, label: 'Confirmed' },
  preparing: { color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: ChefHat, label: 'Preparing' },
  ready: { color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2, label: 'Ready' },
  delivered: { color: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300', icon: CheckCircle2, label: 'Delivered' },
  cancelled: { color: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400', icon: XCircle, label: 'Cancelled' },
};

interface SocketOrderEvent {
  id?: string;
  orderId?: string;
  orderNumber?: string;
  order_number?: string;
  moduleId?: string;
  module_id?: string;
  status?: Order['status'];
}

import { useSiteSettings } from '@/lib/settings-context';

import { createPortal } from 'react-dom';

export default function AdminRestaurantOrdersPage() {
  const { modules } = useSiteSettings();
  const restaurantModule = modules.find(m => m.slug === 'restaurant');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { socket } = useSocket();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const fetchOrders = useCallback(async () => {
    if (!restaurantModule) return;
    try {
      const response = await api.get('/restaurant/staff/orders', {
        params: { moduleId: restaurantModule.id }
      });
      setOrders(response.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch orders');
    } finally {
      setLoading(false);
    }
  }, [restaurantModule]);

  useEffect(() => {
    if (restaurantModule) {
      fetchOrders();
    }
  }, [fetchOrders, restaurantModule]);

  useEffect(() => {
    if (socket && restaurantModule) {
      socket.on('order:new', (order: SocketOrderEvent) => {
        if (order.moduleId === restaurantModule.id || order.module_id === restaurantModule.id) {
          // Fetch specific order details or append if full order provided
          // Since socket payload is partial, we might want to refetch or just add brief info
          // For now, let's refetch to be safe, or just toast
          fetchOrders();
          toast.success(`New order #${order.orderNumber || order.order_number}`);
        }
      });

      socket.on('order:updated', (order: SocketOrderEvent) => {
        if (order.moduleId === restaurantModule.id || order.module_id === restaurantModule.id) {
          setOrders((prev) => prev.map((o) => (o.id === order.orderId || o.id === order.id ? { ...o, status: order.status as Order['status'] } : o)));
        }
      });

      return () => {
        socket.off('order:new');
        socket.off('order:updated');
      };
    }
  }, [socket, restaurantModule, fetchOrders]);

  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.patch(`/restaurant/staff/orders/${orderId}/status`, { status });
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
    <>
      <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Restaurant Orders</h1>
            <p className="text-slate-500 dark:text-slate-400">Manage and track kitchen orders</p>
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
                <option value="cancelled">Cancelled</option>
              </select>
            </div>
          </CardContent>
        </Card>

        {/* Orders */}
        <div className="space-y-4">
          <AnimatePresence mode="popLayout">
            {filteredOrders.length === 0 ? (
              <div className="text-center py-12">
                <UtensilsCrossed className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
                <p className="text-slate-500 dark:text-slate-400">No orders found</p>
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
                    <Card
                      className="cursor-pointer hover:shadow-md transition-shadow"
                      onClick={() => setSelectedOrder(order)}
                    >
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
                              {order.table_number && (
                                <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-700 rounded text-xs">
                                  Table {order.table_number}
                                </span>
                              )}
                            </div>

                            <div className="text-sm text-slate-600 dark:text-slate-300 space-y-1">
                              {(order.items || order.order_items)?.slice(0, 3).map((item) => (
                                <p key={item.id}>
                                  {item.quantity}x {item.name || item.menu_items?.name || 'Item'}
                                  {(item.notes || item.specialInstructions || item.special_instructions) && <span className="text-slate-400"> - {item.notes || item.specialInstructions || item.special_instructions}</span>}
                                </p>
                              ))}
                              {((order.items || order.order_items)?.length || 0) > 3 && (
                                <p className="text-xs text-slate-400 italic">
                                  + {((order.items || order.order_items)?.length || 0) - 3} more items...
                                </p>
                              )}
                            </div>

                            <div className="flex items-center gap-4 mt-2 text-xs text-slate-400">
                              <span className="flex items-center gap-1">
                                <Timer className="w-3 h-3" />
                                {formatDate(order.created_at || order.createdAt || new Date().toISOString())}
                              </span>
                              {(order.users || order.customer || order.customerName) && (
                                <span className="flex items-center gap-1">
                                  <User className="w-3 h-3" />
                                  {order.customerName || order.customer?.full_name || order.users?.full_name}
                                </span>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col items-end gap-2">
                            <p className="text-xl font-bold text-slate-900 dark:text-white">
                              {formatCurrency(order.total_amount)}
                            </p>
                            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                              {order.status === 'pending' && (
                                <Button size="sm" onClick={() => updateOrderStatus(order.id, 'confirmed')}>
                                  Confirm
                                </Button>
                              )}
                              {order.status === 'confirmed' && (
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

      {/* Order Details Modal */}
      {mounted && createPortal(
        <AnimatePresence>
          {selectedOrder && (
            <div
              className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
              onClick={() => setSelectedOrder(null)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col relative"
              >
                <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-white dark:bg-slate-800 sticky top-0 z-10">
                  <div>
                    <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                      Order #{selectedOrder.order_number}
                    </h2>
                    <p className="text-sm text-slate-500 dark:text-slate-400">
                      {formatDate(selectedOrder.created_at)}
                    </p>
                  </div>
                  <button
                    onClick={() => setSelectedOrder(null)}
                    className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
                  >
                    <XCircle className="w-6 h-6 text-slate-500" />
                  </button>
                </div>

                <div className="p-6 overflow-y-auto flex-1 space-y-6">
                  {/* Customer Info */}
                  <div className="grid grid-cols-2 gap-4">
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Customer</h3>
                      <p className="font-medium text-slate-900 dark:text-white">
                        {selectedOrder.customerName || selectedOrder.customer?.full_name || selectedOrder.users?.full_name || 'Guest'}
                      </p>
                      {(selectedOrder.table_number || selectedOrder.tableNumber) && (
                        <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                          Table {selectedOrder.table_number || selectedOrder.tableNumber}
                        </p>
                      )}
                    </div>
                    <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                      <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Status</h3>
                      <div className="flex items-center gap-2">
                        {(() => {
                          const config = statusConfig[selectedOrder.status];
                          const StatusIcon = config?.icon || Clock;
                          return (
                            <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-medium ${config?.color}`}>
                              <StatusIcon className="w-4 h-4" />
                              {config?.label}
                            </span>
                          );
                        })()}
                      </div>
                    </div>
                  </div>

                  {/* Items */}
                  <div>
                    <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Order Items</h3>
                    <div className="space-y-3">
                      {(selectedOrder.items || selectedOrder.order_items)?.length === 0 ? (
                        <p className="text-slate-500 dark:text-slate-400 italic">No items found</p>
                      ) : (
                        (selectedOrder.items || selectedOrder.order_items)?.map((item) => (
                          <div key={item.id} className="flex justify-between items-start p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-slate-900 dark:text-white">{item.quantity}x</span>
                                <span className="font-medium text-slate-900 dark:text-white">{item.name || item.menu_items?.name || 'Unknown Item'}</span>
                              </div>
                              {(item.notes || item.specialInstructions || item.special_instructions) && (
                                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 italic">
                                  Note: {item.notes || item.specialInstructions || item.special_instructions}
                                </p>
                              )}
                            </div>
                            <p className="font-medium text-slate-900 dark:text-white">
                              {formatCurrency((item.unitPrice || item.unit_price || 0) * item.quantity)}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {selectedOrder.notes && (
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white mb-2">Order Notes</h3>
                      <p className="text-sm text-slate-600 dark:text-slate-300 bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg border border-yellow-100 dark:border-yellow-900/30">
                        {selectedOrder.notes}
                      </p>
                    </div>
                  )}
                </div>

                <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 sticky bottom-0 z-10">
                  {/* Price Breakdown */}
                  <div className="space-y-2 mb-4">
                    {(() => {
                        const items = selectedOrder.items || selectedOrder.order_items || [];
                        const subtotal = items.reduce((acc, item) => 
                          acc + ((item.unitPrice || item.unit_price || 0) * item.quantity), 0
                        );
                        // Standard values
                        const serviceCharge = subtotal * 0.10;
                        const tax = subtotal * 0.11;
                        const expectedTotal = subtotal + serviceCharge + tax;
                        
                        // Calculated Discount (Floating Point Safe Comparison)
                        const rawDiscount = expectedTotal - (selectedOrder.total_amount || 0);
                        const discount = rawDiscount > 0.05 ? rawDiscount : 0;

                        return (
                          <>
                            <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400">
                              <span>Subtotal</span>
                              <span>{formatCurrency(subtotal)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400">
                              <span>Service Charge (10%)</span>
                              <span>{formatCurrency(serviceCharge)}</span>
                            </div>
                            <div className="flex justify-between items-center text-sm text-slate-500 dark:text-slate-400">
                              <span>Tax (11%)</span>
                              <span>{formatCurrency(tax)}</span>
                            </div>
                            {discount > 0 && (
                              <div className="flex justify-between items-center text-sm font-bold text-green-600 dark:text-green-400">
                                <span>Discount / Points Applied</span>
                                <span>-{formatCurrency(discount)}</span>
                              </div>
                            )}
                          </>
                        );
                    })()}

                    <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-700">
                      <span className="text-lg font-semibold text-slate-900 dark:text-white">Total Amount</span>
                      <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                        {formatCurrency(selectedOrder.total_amount)}
                      </span>
                    </div>
                  </div>

                  <div className="flex justify-end gap-3">
                    {selectedOrder.status === 'pending' && (
                      <Button onClick={() => { updateOrderStatus(selectedOrder.id, 'confirmed'); setSelectedOrder(null); }}>
                        Confirm Order
                      </Button>
                    )}
                    {selectedOrder.status === 'confirmed' && (
                      <Button onClick={() => { updateOrderStatus(selectedOrder.id, 'preparing'); setSelectedOrder(null); }}>
                        Start Preparing
                      </Button>
                    )}
                    {selectedOrder.status === 'preparing' && (
                      <Button onClick={() => { updateOrderStatus(selectedOrder.id, 'ready'); setSelectedOrder(null); }}>
                        Mark Ready
                      </Button>
                    )}
                    {selectedOrder.status === 'ready' && (
                      <Button onClick={() => { updateOrderStatus(selectedOrder.id, 'delivered'); setSelectedOrder(null); }}>
                        Mark Delivered
                      </Button>
                    )}
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  );
}
