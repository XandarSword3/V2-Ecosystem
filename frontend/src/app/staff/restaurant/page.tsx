'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useRestaurantOrders } from '@/lib/socket';
import { formatCurrency, formatTime, getOrderStatusColor } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import {
  UtensilsCrossed,
  Clock,
  CheckCircle,
  ChefHat,
  Bell,
  RefreshCw,
  User,
  LogOut,
  XCircle,
  Timer,
} from 'lucide-react';

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  status: string;
  items: {
    id: string;
    name: string;
    quantity: number;
    specialInstructions?: string;
  }[];
  totalAmount: number;
  createdAt: string;
  tableNumber?: string;
}

const statusFlow = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed'];

export default function RestaurantKitchenPage() {
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);

  // Load initial orders
  useEffect(() => {
    loadOrders();
  }, []);

  // Real-time updates
  useRestaurantOrders(
    (newOrder) => {
      setOrders((prev) => [newOrder, ...prev]);
      toast.info(`New order #${newOrder.orderNumber}`, {
        description: newOrder.customerName,
      });
      // Play notification sound
      const audio = new Audio('/notification.mp3');
      audio.play().catch(() => { });
    },
    (update) => {
      setOrders((prev) =>
        prev.map((order) =>
          order.id === update.orderId
            ? { ...order, status: update.status }
            : order
        )
      );
    }
  );

  const loadOrders = async () => {
    try {
      const response = await api.get('/restaurant/staff/orders', {
        params: { status: 'pending,confirmed,preparing,ready' },
      });
      setOrders(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load orders');
    } finally {
      setIsLoading(false);
    }
  };

  const updateOrderStatus = async (orderId: string, newStatus: string) => {
    try {
      await api.patch(`/restaurant/staff/orders/${orderId}/status`, {
        status: newStatus,
      });
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: newStatus } : order
        )
      );
      toast.success(`Order updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update order');
    }
  };

  const getNextStatus = (currentStatus: string): string | null => {
    const currentIndex = statusFlow.indexOf(currentStatus);
    if (currentIndex < statusFlow.length - 1) {
      return statusFlow[currentIndex + 1];
    }
    return null;
  };

  const filteredOrders = selectedStatus
    ? orders.filter((order) => order.status === selectedStatus)
    : orders;

  const ordersByStatus = {
    pending: orders.filter((o) => o.status === 'pending'),
    confirmed: orders.filter((o) => o.status === 'confirmed'),
    preparing: orders.filter((o) => o.status === 'preparing'),
    ready: orders.filter((o) => o.status === 'ready'),
    served: orders.filter((o) => o.status === 'served'),
  };

  return (
    <div className="space-y-6">
      {/* Status Summary */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { status: 'pending', label: 'Pending', icon: Bell, color: 'bg-yellow-500' },
          { status: 'confirmed', label: 'Confirmed', icon: CheckCircle, color: 'bg-blue-500' },
          { status: 'preparing', label: 'Preparing', icon: ChefHat, color: 'bg-orange-500' },
          { status: 'ready', label: 'Ready', icon: Clock, color: 'bg-green-500' },
          { status: 'served', label: 'Served', icon: UtensilsCrossed, color: 'bg-emerald-500' },
        ].map(({ status, label, icon: Icon, color }) => (
          <button
            key={status}
            onClick={() => setSelectedStatus(selectedStatus === status ? null : status)}
            className={`card p-4 text-center transition-all ${selectedStatus === status ? 'ring-2 ring-primary-500' : ''
              }`}
          >
            <div className={`w-12 h-12 ${color} rounded-full flex items-center justify-center mx-auto mb-2`}>
              <Icon className="w-6 h-6 text-white" />
            </div>
            <div className="text-2xl font-bold text-slate-900">
              {ordersByStatus[status as keyof typeof ordersByStatus].length}
            </div>
            <div className="text-sm text-slate-600">{label}</div>
          </button>
        ))}
      </div>

      {/* Kanban Board */}
      <div className="grid grid-cols-5 gap-4">
        {['pending', 'confirmed', 'preparing', 'ready', 'served'].map((status) => (
          <div key={status} className="bg-white rounded-lg p-4">
            <h2 className="font-semibold text-slate-900 mb-4 flex items-center">
              <span
                className={`w-3 h-3 rounded-full mr-2 ${status === 'pending' ? 'bg-yellow-500' :
                    status === 'confirmed' ? 'bg-blue-500' :
                      status === 'preparing' ? 'bg-orange-500' :
                        status === 'ready' ? 'bg-green-500' : 'bg-emerald-500'
                  }`}
              />
              {status.charAt(0).toUpperCase() + status.slice(1)}
              <span className="ml-2 text-slate-400">
                ({ordersByStatus[status as keyof typeof ordersByStatus].length})
              </span>
            </h2>

            <div className="space-y-3 max-h-[calc(100vh-300px)] overflow-y-auto">
              {ordersByStatus[status as keyof typeof ordersByStatus].map((order) => (
                <div
                  key={order.id}
                  className="border border-slate-200 rounded-lg p-3 hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="font-bold text-slate-900 dark:text-white">#{order.orderNumber}</span>
                      <span className={`ml-2 badge ${order.orderType === 'dine_in' ? 'badge-info' :
                          order.orderType === 'takeaway' ? 'badge-warning' : 'badge-primary'
                        }`}>
                        {order.orderType.replace('_', ' ')}
                      </span>
                    </div>
                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center">
                      <Clock className="w-3 h-3 mr-1" />
                      {formatTime(order.createdAt)}
                    </span>
                  </div>

                  <div className="text-sm text-slate-600 dark:text-slate-400 mb-2">
                    {order.customerName}
                    {order.tableNumber && (
                      <span className="ml-2 font-medium">• Table {order.tableNumber}</span>
                    )}
                  </div>

                  <div className="border-t pt-2 mb-3">
                    {order.items.map((item, idx) => (
                      <div key={idx} className="text-sm py-1">
                        <span className="font-medium">{item.quantity}×</span> {item.name}
                        {item.specialInstructions && (
                          <p className="text-xs text-orange-600 italic ml-4">
                            {item.specialInstructions}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="font-bold text-slate-900">
                      {formatCurrency(order.totalAmount)}
                    </span>
                    {getNextStatus(order.status) && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          updateOrderStatus(order.id, getNextStatus(order.status)!);
                        }}
                        className="btn btn-primary btn-sm text-xs"
                      >
                        Mark {getNextStatus(order.status)}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {ordersByStatus[status as keyof typeof ordersByStatus].length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  No orders
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedOrder(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white">
                  Order #{selectedOrder.orderNumber}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {formatTime(selectedOrder.createdAt)}
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
                    {selectedOrder.customerName}
                  </p>
                  {selectedOrder.tableNumber && (
                    <p className="text-sm text-slate-600 dark:text-slate-300 mt-1">
                      Table {selectedOrder.tableNumber}
                    </p>
                  )}
                </div>
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">Status</h3>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-medium ${selectedOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        selectedOrder.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          selectedOrder.status === 'preparing' ? 'bg-orange-100 text-orange-800' :
                            selectedOrder.status === 'ready' ? 'bg-green-100 text-green-800' :
                              'bg-emerald-100 text-emerald-800'
                      }`}>
                      {selectedOrder.status.charAt(0).toUpperCase() + selectedOrder.status.slice(1)}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3">Order Items</h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-start p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-900 dark:text-white">{item.quantity}x</span>
                          <span className="font-medium text-slate-900 dark:text-white">{item.name}</span>
                        </div>
                        {item.specialInstructions && (
                          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 italic">
                            Note: {item.specialInstructions}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold text-slate-900 dark:text-white">Total Amount</span>
                <span className="text-2xl font-bold text-primary-600 dark:text-primary-400">
                  {formatCurrency(selectedOrder.totalAmount)}
                </span>
              </div>

              <div className="flex justify-end gap-3">
                {getNextStatus(selectedOrder.status) && (
                  <Button onClick={() => {
                    updateOrderStatus(selectedOrder.id, getNextStatus(selectedOrder.status)!);
                    setSelectedOrder(null);
                  }}>
                    Mark {getNextStatus(selectedOrder.status)}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
