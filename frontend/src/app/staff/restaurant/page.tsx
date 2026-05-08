'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useAuth } from '@/lib/auth-context';
import { useRestaurantOrders } from '@/lib/socket';
import { formatCurrency, formatTime, getOrderStatusColor } from '@/lib/utils';
import { api } from '@/lib/api';
import { isOnline } from '@/lib/offline/offline-storage';
import { createOfflineOrderStatusUpdate } from '@/lib/offline/offline-sync';
import { FloorPlan } from '@/components/FloorPlan';
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

interface SelectedModifier {
  optionId: string;
  optionName: string;
  groupId: string;
  groupName: string;
  modifierType?: 'add' | 'remove' | 'swap'; // Optional for unified customizations
  customizationType?: 'add' | 'remove' | 'swap' | 'upgrade' | 'replace' | 'select'; // Unified system field
  priceAdjustment: number;
  quantity: number;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  specialInstructions?: string;
  selected_modifiers?: SelectedModifier[];
  selectedModifiers?: SelectedModifier[];
  modifier_total?: string | number;
  modifierTotal?: number;
}

interface Order {
  id: string;
  orderNumber: string;
  customerName: string;
  orderType: 'dine_in' | 'takeaway' | 'delivery';
  status: string;
  items: OrderItem[];
  totalAmount: number;
  createdAt: string;
  tableNumber?: string;
}

const statusFlow = ['pending', 'confirmed', 'preparing', 'ready', 'served', 'completed'];

export default function RestaurantKitchenPage() {
  const t = useTranslations('staff');
  const tc = useTranslations('adminCommon');
  const tr = useTranslations('staff.restaurant');
  const ts = useTranslations('staff.statuses');
  const { user, logout } = useAuth();
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [activeTab, setActiveTab] = useState<'orders' | 'floor_plan'>('orders');

  // Load initial orders
  useEffect(() => {
    loadOrders();
  }, []);

  // Real-time updates
  useRestaurantOrders(
    (newOrder) => {
      // Refetch orders to get full order data
      loadOrders();
      toast.info(`New order received`, {
        description: newOrder.customerName || `Order with ${newOrder.items} items`,
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
      toast.error(tc('errors.failedToLoad'));
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
      toast.success(t('orders.orderUpdated', { status: newStatus }));
    } catch (error) {
      if (!isOnline()) {
        await createOfflineOrderStatusUpdate(orderId, newStatus);
        setOrders((prev) =>
          prev.map((order) =>
            order.id === orderId ? { ...order, status: newStatus } : order
          )
        );
        toast.info(t('orders.orderUpdatedOffline'), { icon: '⏳' });
        return;
      }
      toast.error(tc('errors.failedToUpdate'));
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
      <div className="flex gap-2">
        <Button
          variant={activeTab === 'orders' ? 'primary' : 'outline'}
          onClick={() => setActiveTab('orders')}
        >
          Orders
        </Button>
        <Button
          variant={activeTab === 'floor_plan' ? 'primary' : 'outline'}
          onClick={() => setActiveTab('floor_plan')}
        >
          Floor Plan
        </Button>
      </div>

      {activeTab === 'floor_plan' ? (
        <FloorPlan />
      ) : (
        <>
      {/* Status Summary */}
      <div className="grid grid-cols-5 gap-4 mb-6">
        {[
          { status: 'pending', label: ts('pending'), icon: Bell, color: 'bg-yellow-500' },
          { status: 'confirmed', label: ts('confirmed'), icon: CheckCircle, color: 'bg-blue-500' },
          { status: 'preparing', label: ts('preparing'), icon: ChefHat, color: 'bg-orange-500' },
          { status: 'ready', label: ts('ready'), icon: Clock, color: 'bg-green-500' },
          { status: 'served', label: ts('served'), icon: UtensilsCrossed, color: 'bg-emerald-500' },
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
              {ts(status as 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served')}
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
                    {order.items.map((item, idx) => {
                      const modifiers = item.selected_modifiers || item.selectedModifiers || [];
                      return (
                        <div key={idx} className="text-sm py-1">
                          <span className="font-medium">{item.quantity}×</span> {item.name}
                          {modifiers.length > 0 && (
                            <div className="ml-4 text-xs space-y-0.5">
                              {modifiers.map((mod, modIdx) => {
                                // Support both legacy modifierType and unified customizationType
                                const type = mod.modifierType || (mod as any).customizationType || 'add';
                                const isRemove = type === 'remove';
                                const isSwap = ['swap', 'replace', 'upgrade'].includes(type);
                                return (
                                  <div key={modIdx} className={`${
                                    isRemove 
                                      ? 'text-red-600' 
                                      : isSwap
                                      ? 'text-blue-600'
                                      : 'text-green-600'
                                  }`}>
                                    {isRemove ? '−' : isSwap ? '↔' : '+'} {mod.optionName}
                                    {mod.quantity > 1 && <span className="opacity-70"> ×{mod.quantity}</span>}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {item.specialInstructions && (
                            <p className="text-xs text-orange-600 italic ml-4 mt-1">
                              "{item.specialInstructions}"
                            </p>
                          )}
                        </div>
                      );
                    })}
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
                        {tr('markStatus', { status: ts(getNextStatus(order.status) as 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served') })}
                      </button>
                    )}
                  </div>
                </div>
              ))}

              {ordersByStatus[status as keyof typeof ordersByStatus].length === 0 && (
                <div className="text-center py-8 text-slate-400">
                  {tr('noOrders')}
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Order Details Modal */}
      {/* FIX Iter-21: order detail modal a11y — role, aria-modal, aria-labelledby, Escape handler */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm"
          onClick={() => setSelectedOrder(null)}
          role="dialog" aria-modal="true" aria-labelledby="restaurant-order-detail-title" onKeyDown={(e) => { if (e.key === 'Escape') setSelectedOrder(null); }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white dark:bg-slate-800 rounded-xl shadow-xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col"
          >
            <div className="p-6 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-slate-900 dark:text-white" id="restaurant-order-detail-title">
                  Order #{selectedOrder.orderNumber}
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400">
                  {formatTime(selectedOrder.createdAt)}
                </p>
              </div>
              <button
                onClick={() => setSelectedOrder(null)}
                aria-label="Close order details"
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-full transition-colors"
              >{/* FIX Iter-21: close button a11y */}
                <XCircle className="w-6 h-6 text-slate-500" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1 space-y-6">
              {/* Customer Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-slate-50 dark:bg-slate-700/50 rounded-lg">
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{tr('customer')}</h3>
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
                  <h3 className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-1">{tr('status')}</h3>
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-sm font-medium ${selectedOrder.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                        selectedOrder.status === 'confirmed' ? 'bg-blue-100 text-blue-800' :
                          selectedOrder.status === 'preparing' ? 'bg-orange-100 text-orange-800' :
                            selectedOrder.status === 'ready' ? 'bg-green-100 text-green-800' :
                              'bg-emerald-100 text-emerald-800'
                      }`}>
                      {ts(selectedOrder.status as 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Items */}
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white mb-3">{tr('orderItems')}</h3>
                <div className="space-y-3">
                  {selectedOrder.items.map((item, idx) => {
                    const modifiers = item.selected_modifiers || item.selectedModifiers || [];
                    return (
                      <div key={idx} className="flex justify-between items-start p-3 border border-slate-200 dark:border-slate-700 rounded-lg">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-slate-900 dark:text-white">{item.quantity}x</span>
                            <span className="font-medium text-slate-900 dark:text-white">{item.name}</span>
                          </div>
                          {modifiers.length > 0 && (
                            <div className="mt-2 ml-6 space-y-1">
                              <div className="text-xs font-medium text-slate-600 dark:text-slate-400">Customizations:</div>
                              {modifiers.map((mod, modIdx) => {
                                // Support both legacy modifierType and unified customizationType
                                const type = mod.modifierType || (mod as any).customizationType || 'add';
                                const isRemove = type === 'remove';
                                const isSwap = ['swap', 'replace', 'upgrade'].includes(type);
                                return (
                                  <div key={modIdx} className="flex items-center gap-2 text-sm">
                                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                                      isRemove 
                                        ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                                        : isSwap
                                        ? 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400'
                                        : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                                    }`}>
                                      {isRemove ? '−' : isSwap ? '↔' : '+'}
                                    </span>
                                    <span className="text-slate-700 dark:text-slate-300">
                                      {mod.optionName}
                                      {mod.quantity > 1 && <span className="opacity-70"> ×{mod.quantity}</span>}
                                      {mod.priceAdjustment !== 0 && (
                                        <span className="ml-1 text-xs text-slate-500">
                                          ({mod.priceAdjustment > 0 ? '+' : ''}{formatCurrency(mod.priceAdjustment)})
                                        </span>
                                      )}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          {item.specialInstructions && (
                            <div className="mt-2 ml-6 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded text-sm">
                              <span className="font-medium text-amber-800 dark:text-amber-400">Special Instructions:</span>
                              <p className="text-amber-700 dark:text-amber-300 italic">"{item.specialInstructions}"</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50">
              <div className="flex justify-between items-center mb-4">
                <span className="text-lg font-semibold text-slate-900 dark:text-white">{tr('totalAmount')}</span>
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
                    {tr('markStatus', { status: ts(getNextStatus(selectedOrder.status) as 'pending' | 'confirmed' | 'preparing' | 'ready' | 'served') })}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
        </>
      )}
    </div>
  );
}
