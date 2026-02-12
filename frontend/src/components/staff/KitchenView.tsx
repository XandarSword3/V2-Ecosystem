'use client';

import { useEffect, useState } from 'react';
import { useSocket } from '@/lib/socket';
import { formatCurrency, formatTime, getOrderStatusColor } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import {
  UtensilsCrossed,
  Clock,
  ChefHat,
  RefreshCw,
  User,
  XCircle,
} from 'lucide-react';
import { Order, statusFlow } from './types';

export interface KitchenViewProps {
  slug: string;
  moduleName: string;
  moduleId: string;
}

export function KitchenView({ slug, moduleName, moduleId }: KitchenViewProps) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
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

      socket.on('order:new', handleNewOrder);
      socket.on('order:status', handleStatusUpdate);
      socket.on('new-order', handleNewOrder);
      socket.on('order-status-updated', handleStatusUpdate);

      return () => {
        // FIX Iter-13: Leave socket rooms on cleanup to prevent room leak
        socket.emit('leave:unit', moduleId);
        socket.emit('leave:unit', slug);
        socket.off('order:new', handleNewOrder);
        socket.off('order:status', handleStatusUpdate);
        socket.off('new-order', handleNewOrder);
        socket.off('order-status-updated', handleStatusUpdate);
      };
    }
  }, [socket, moduleId, slug]);

  const loadOrders = async () => {
    try {
      const response = await api.get(`/staff/modules/${slug}/orders`, {
        params: {
          status: 'pending,confirmed,preparing,ready,served',
          moduleId: moduleId,
        },
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
      toast.error('Failed to update order status');
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
            served: { bg: 'bg-purple-50 dark:bg-purple-900/10', border: 'border-purple-300 dark:border-purple-700', text: 'text-purple-700 dark:text-purple-300', action: 'Complete', actionBg: 'bg-gray-600 hover:bg-gray-700', label: 'Served' },
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
                          {/* Order Type Badge */}
                          <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium capitalize ${
                            order.orderType === 'dine_in' ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300'
                            : order.orderType === 'delivery' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                            : 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300'
                          }`}>
                            {order.orderType?.replace('_', ' ') || 'dine in'}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 text-[10px] text-gray-500 dark:text-gray-400 mb-2">
                          <Clock className="h-3 w-3" />
                          <span>{formatTime(order.createdAt)}</span>
                        </div>

                        <div className="space-y-1 mb-2">
                          {order.items.map((item) => (
                            <div key={item.id} className="text-xs">
                              <div className="flex gap-1.5">
                                <span className="font-medium bg-gray-100 dark:bg-gray-700 px-1 rounded text-[10px]">
                                  {item.quantity}x
                                </span>
                                <span className="text-gray-700 dark:text-gray-300">{item.name}</span>
                              </div>
                              {/* Modifier Display */}
                              {item.specialInstructions && (
                                <p className="text-[10px] text-yellow-700 dark:text-yellow-300 bg-yellow-50 dark:bg-yellow-900/20 px-1.5 py-0.5 rounded mt-0.5 ml-5">
                                  {item.specialInstructions}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>

                        <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-700 text-xs">
                          <span className="text-gray-500 truncate max-w-[80px]">{order.customerName}</span>
                          <span className="font-bold text-primary">{formatCurrency(order.totalAmount)}</span>
                        </div>
                      </div>

                      {/* Quick Action */}
                      {nextStatus && (
                        <div className="px-2 pb-2">
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
                <p className="text-sm text-gray-500 mt-1">
                  {formatTime(selectedOrder.createdAt)} • {selectedOrder.customerName}
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
              <div className="space-y-4">
                {selectedOrder.items.map((item) => (
                  <div
                    key={item.id}
                    className="flex justify-between items-start py-2 border-b border-gray-50 dark:border-gray-700/50 last:border-0"
                  >
                    <div className="flex gap-3">
                      <div className="bg-primary/10 text-primary font-bold w-8 h-8 rounded flex items-center justify-center shrink-0">
                        {item.quantity}
                      </div>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.specialInstructions && (
                          <p className="text-sm text-yellow-600 dark:text-yellow-400 mt-1 bg-yellow-50 dark:bg-yellow-900/20 p-1.5 rounded">
                            Note: {item.specialInstructions}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
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

            <div className="p-4 bg-gray-50 dark:bg-gray-800/50 border-t border-gray-100 dark:border-gray-700 flex gap-3">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setSelectedOrder(null)}
              >
                Close
              </Button>
              {selectedOrder.status !== 'completed' && (
                <Button
                  className="flex-1"
                  onClick={() => {
                    const nextStatus = statusFlow[statusFlow.indexOf(selectedOrder.status) + 1];
                    if (nextStatus) updateOrderStatus(selectedOrder.id, nextStatus);
                  }}
                >
                  Advance Status
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
