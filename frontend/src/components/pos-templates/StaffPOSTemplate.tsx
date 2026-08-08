'use client';

/**
 * POS Staff Module Template
 * Comprehensive staff interface for order fulfillment:
 * - Live table floorplan with status
 * - Order management (accept, modify, merge/split)
 * - Kitchen Display System (KDS) view
 * - Payment processing at table
 * - Cash drawer management
 * - Shift workflow
 */

import { useEffect, useState, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/lib/socket';
import { formatCurrency, formatTime } from '@/lib/utils';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  LayoutGrid,
  UtensilsCrossed,
  ChefHat,
  CreditCard,
  Clock,
  Bell,
  Users,
  RefreshCw,
  Plus,
  Minus,
  Check,
  X,
  AlertTriangle,
  Printer,
  Receipt,
  DollarSign,
  Timer,
  ArrowRight,
  Split,
  Merge,
  Pause,
  Play,
  Eye,
  Camera,
  MapPin,
  Truck,
} from 'lucide-react';
import { ReservationFloorMap } from '@/components/staff/ReservationFloorMap';
import { DispatchBoard } from '@/components/staff/DispatchBoard';

// Types
interface Table {
  id: string;
  number: string;
  capacity: number;
  status: 'available' | 'occupied' | 'reserved' | 'dirty';
  currentOrder?: Order;
  server?: string;
}

interface Order {
  id: string;
  orderNumber: string;
  tableNumber?: string;
  status: string;
  items: OrderItem[];
  totalAmount: number;
  createdAt: string;
  customerName?: string;
  orderType: string;
  prepStartedAt?: string;
  etaMinutes?: number;
  paymentMethod?: string;
  paymentStatus?: string;
}

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  unitPrice: number;
  modifiers?: string[];
  notes?: string;
  status: string;
  station?: string;
}

interface Shift {
  id: string;
  startTime: string;
  endTime?: string;
  openingCash: number;
  closingCash?: number;
  status: 'active' | 'closed';
}

interface StaffPOSTemplateProps {
  moduleId: string;
  moduleSlug: string;
  moduleName: string;
  // Floor Map (host-stand tab) only makes sense for modules that take
  // reservations. Mirrors the gate that used to live in the sidebar nav.
  requireReservation?: boolean | null;
}

type ViewMode = 'floor' | 'orders' | 'kitchen' | 'cashier' | 'floorplan' | 'dispatch';

export default function StaffPOSTemplate({ moduleId, moduleSlug, moduleName, requireReservation }: StaffPOSTemplateProps) {
  const t = useTranslations();
  const { user } = useAuth();
  const { socket } = useSocket();

  // State
  const [viewMode, setViewMode] = useState<ViewMode>('floor');
  const [tables, setTables] = useState<Table[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [currentShift, setCurrentShift] = useState<Shift | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showShiftModal, setShowShiftModal] = useState(false);
  const [kitchenOrders, setKitchenOrders] = useState<Order[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('active');
  // Cash drawer modal
  const [showCashModal, setShowCashModal] = useState(false);
  const [cashModalType, setCashModalType] = useState<'in' | 'out'>('in');
  // Cash movement totals
  const [cashTotals, setCashTotals] = useState<{ cashIn: number; cashOut: number; net: number }>({ cashIn: 0, cashOut: 0, net: 0 });
  // Item picker modal for adding to existing table order
  const [showItemPicker, setShowItemPicker] = useState(false);
  const [menuItems, setMenuItems] = useState<any[]>([]);

  // Fetch data
  const fetchData = useCallback(async () => {
    try {
      const [tablesRes, ordersRes, shiftRes] = await Promise.all([
        api.get(`/staff/modules/${moduleSlug}/tables`),
        api.get(`/staff/modules/${moduleSlug}/orders`, {
          params: { status: 'pending,confirmed,preparing,ready,completed,delivered' }
        }),
        api.get('/staff/shifts/me/current'),
      ]);

      // Normalize tables: backend returns { id, name, isOccupied, openTransactionId }
      // but Table interface expects { id, number, capacity, status }
      const rawTables = tablesRes.data.data || [];
      const mappedTables: Table[] = rawTables.map((t: any) => ({
        id: t.id,
        number: t.number || t.name || 'Table',
        capacity: t.capacity || t.seats || 4,
        status: t.status || (t.isOccupied ? 'occupied' : 'available'),
        currentOrder: t.currentOrder || null,
        openTransactionId: t.openTransactionId || null,
      }));

      setTables(mappedTables);
      setSelectedTable(prev => prev ? (mappedTables.find(t => t.id === prev.id) || prev) : null);

      setOrders(ordersRes.data.data || []);
      setKitchenOrders((ordersRes.data.data || []).filter(
        (o: Order) => ['confirmed', 'preparing'].includes(o.status)
      ));

      // Normalize shift: backend returns snake_case (opening_cash, start_time)
      // but Shift interface expects camelCase (openingCash, startTime)
      const shiftData = shiftRes.data.data;
      if (shiftData) {
        setCurrentShift({
          id: shiftData.id,
          startTime: shiftData.startTime || shiftData.start_time || shiftData.actual_start || shiftData.actualStart || '',
          endTime: shiftData.endTime || shiftData.end_time || shiftData.actual_end || undefined,
          openingCash: Number(shiftData.opening_cash ?? shiftData.openingCash ?? 0),
          closingCash: shiftData.closing_cash != null ? Number(shiftData.closing_cash) : (shiftData.closingCash != null ? Number(shiftData.closingCash) : undefined),
          status: shiftData.status || 'active',
        });

        // Fetch cash movements for this shift
        const cashRes = await api.get(`/staff/shifts/${shiftData.id}/cash`);
        if (cashRes.data.success) {
          setCashTotals(cashRes.data.totals || { cashIn: 0, cashOut: 0, net: 0 });
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  }, [moduleSlug]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Real-time updates
  useEffect(() => {
    if (socket) {
      socket.emit('join:unit', moduleSlug);

      const handleNewOrder = (order: Order) => {
        setOrders(prev => [order, ...prev]);
        if (['confirmed', 'preparing'].includes(order.status)) {
          setKitchenOrders(prev => [order, ...prev]);
        }
        toast.info(`New order #${order.orderNumber}`, { description: order.customerName });
        // Play notification sound
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => { });
      };

      // FIX: this listened for 'order:updated', but Accept/Start Prep/Mark
      // Ready/Served/Cancel all go through the shared status-transition
      // service (order-status.service.ts), which emits 'order:status' with
      // payload { id, status, tableNumber } — not { orderId, status }.
      // 'order:updated' is real but only fires on item-add and payment, so
      // status changes (like Accept) never reached this handler at all.
      const handleStatusUpdate = (update: { id: string; status: string }) => {
        setOrders(prev => prev.map(o =>
          o.id === update.id ? { ...o, status: update.status } : o
        ));
        setKitchenOrders(prev => {
          if (['confirmed', 'preparing'].includes(update.status)) {
            const order = orders.find(o => o.id === update.id);
            if (order && !prev.find(o => o.id === update.id)) {
              return [{ ...order, status: update.status }, ...prev];
            }
            return prev.map(o => o.id === update.id ? { ...o, status: update.status } : o);
          }
          return prev.filter(o => o.id !== update.id);
        });
      };

      // FIX: 'table:update' is never emitted anywhere in the backend.
      // 'table:freed' is real (emitted on transaction completion, currently
      // only for reservation-linked orders — see dynamic-module.router.ts)
      // and carries { serviceLocationId }, not a full Table object.
      const handleTableFreed = (payload: { serviceLocationId?: string }) => {
        if (!payload.serviceLocationId) return;
        setTables(prev => prev.map(t =>
          t.id === payload.serviceLocationId
            ? { ...t, status: 'available', currentOrder: undefined, openTransactionId: null }
            : t
        ));
      };

      socket.on('order:new', handleNewOrder);
      socket.on('order:status', handleStatusUpdate);
      socket.on('table:freed', handleTableFreed);

      return () => {
        socket.off('order:new', handleNewOrder);
        socket.off('order:status', handleStatusUpdate);
        socket.off('table:freed', handleTableFreed);
      };
    }
  }, [socket, moduleId, orders]);

  // Order actions
  const updateOrderStatus = async (orderId: string, status: string) => {
    try {
      await api.patch(`/staff/modules/${moduleSlug}/orders/${orderId}/status`, { status });
      setOrders(prev => prev.map(o =>
        o.id === orderId ? { ...o, status } : o
      ));
      toast.success(`Order updated to ${status}`);
    } catch (error) {
      toast.error('Failed to update order');
    }
  };

  const acceptOrder = (orderId: string) => updateOrderStatus(orderId, 'confirmed');
  const startPreparing = (orderId: string) => updateOrderStatus(orderId, 'preparing');
  const markReady = (orderId: string) => updateOrderStatus(orderId, 'ready');
  const markServed = (orderId: string) => updateOrderStatus(orderId, 'delivered');
  const markCompleted = (orderId: string) => updateOrderStatus(orderId, 'completed');

  // Add item to existing order
  const addItemToOrder = async (orderId: string, item: any) => {
    try {
      await api.post(`/staff/modules/${moduleSlug}/orders/${orderId}/items`, item);
      toast.success('Item added to order');
      fetchData();
    } catch (error) {
      toast.error('Failed to add item');
    }
  };

  // Split/merge tables
  const splitTable = async (tableId: string, newTableId: string, itemIds: string[]) => {
    try {
      await api.post(`/staff/modules/${moduleSlug}/tables/${tableId}/split`, {
        newTableId,
        itemIds
      });
      toast.success('Table split successfully');
    } catch (error) {
      toast.error('Failed to split table');
    }
  };

  const mergeTables = async (sourceTableId: string, targetTableId: string) => {
    try {
      await api.post(`/staff/modules/${moduleSlug}/tables/${sourceTableId}/merge`, {
        targetTableId
      });
      toast.success('Tables merged successfully');
    } catch (error) {
      toast.error('Failed to merge tables');
    }
  };

  // Shift management
  const startShift = async (openingCash: number) => {
    try {
      const res = await api.post('/staff/shifts', { openingCash, moduleId });
      const d = res.data.data;
      setCurrentShift({
        id: d.id,
        startTime: d.startTime || d.start_time || d.actual_start || '',
        endTime: d.endTime || d.end_time || undefined,
        openingCash: Number(d.opening_cash ?? d.openingCash ?? openingCash),
        closingCash: undefined,
        status: d.status || 'active',
      });
      setShowShiftModal(false);
      toast.success('Shift started');
    } catch (error) {
      toast.error('Failed to start shift');
    }
  };

  const endShift = async (closingCash: number) => {
    try {
      await api.post(`/staff/shifts/${currentShift?.id}/close`, { closingCash });
      setCurrentShift(null);
      setShowShiftModal(false);
      toast.success('Shift ended');
    } catch (error) {
      toast.error('Failed to end shift');
    }
  };

  // Process payment
  const processPayment = async (orderId: string, method: string, amount: number, tip?: number) => {
    try {
      const res = await api.post(`/staff/modules/${moduleSlug}/orders/${orderId}/pay`, {
        paymentMethod: method,
        amountPaid: amount,
        tipAmount: tip,
      });
      // Update local order state so Cashier view reflects the payment immediately
      setOrders(prev => prev.map(o =>
        o.id === orderId
          ? { ...o, status: res.data.data?.status || 'completed', paymentMethod: method, paymentStatus: 'paid' }
          : o
      ));
      // Release the table if the order was for a table
      const paidOrder = orders.find(o => o.id === orderId);
      if (paidOrder?.tableNumber) {
        setTables(prev => prev.map(t =>
          t.number === paidOrder.tableNumber ? { ...t, status: 'available', currentOrder: undefined } : t
        ));
      }
      toast.success('Payment processed');
      setShowPaymentModal(false);
      setSelectedOrder(null);
    } catch (error) {
      toast.error('Payment failed');
    }
  };

  // Print receipt
  const printReceipt = async (orderId: string) => {
    try {
      await api.post(`/staff/modules/${moduleSlug}/orders/${orderId}/print`);
      toast.success('Receipt sent to printer');
    } catch (error) {
      toast.error('Failed to print');
    }
  };

  // Cash drawer: Pay In / Pay Out
  const processCashAdjustment = async (type: 'in' | 'out', amount: number, note: string) => {
    try {
      await api.post(`/staff/shifts/${currentShift?.id}/cash`, { type, amount, note });
      toast.success(`Cash ${type === 'in' ? 'added to' : 'removed from'} drawer`);
      setShowCashModal(false);
      // Refresh cash totals after recording movement
      if (currentShift?.id) {
        const cashRes = await api.get(`/staff/shifts/${currentShift.id}/cash`);
        if (cashRes.data.success) {
          setCashTotals(cashRes.data.totals || { cashIn: 0, cashOut: 0, net: 0 });
        }
      }
    } catch (error) {
      toast.error('Failed to record cash adjustment');
    }
  };

  // Create new order for an available table
  const createNewOrder = async (tableId: string) => {
    try {
      const res = await api.post(`/staff/modules/${moduleSlug}/orders`, {
        serviceLocationId: tableId,
        tableId,
        orderType: 'dine_in',
        moduleId,
      });
      const newOrder = res.data.data;
      setOrders(prev => [newOrder, ...prev]);
      setTables(prev => prev.map(t =>
        t.id === tableId ? { ...t, status: 'occupied', currentOrder: newOrder } : t
      ));
      setSelectedTable(prev => prev?.id === tableId ? { ...prev, status: 'occupied', currentOrder: newOrder } : prev);
      toast.success(`Order #${newOrder.orderNumber} created`);
    } catch (error) {
      toast.error('Failed to create order');
    }
  };

  // Fetch menu items for the item picker
  const fetchMenuItems = async () => {
    try {
      const res = await api.get(`/staff/modules/${moduleSlug}/menu`);
      const menuData = res.data.data;
      setMenuItems(Array.isArray(menuData) ? menuData : menuData?.items || []);
    } catch (error) {
      toast.error('Failed to load menu');
    }
  };

  // Calculate order time
  const getOrderTime = (createdAt: string) => {
    const minutes = Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000);
    return minutes;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  // Check if shift is active
  if (!currentShift) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100 dark:bg-gray-900">
        <Card className="max-w-md w-full mx-4">
          <CardHeader>
            <CardTitle className="text-center">Start Your Shift</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-center text-gray-500 mb-6">
              Please start your shift to begin taking orders
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">Opening Cash</label>
                <input
                  type="number"
                  placeholder="0.00"
                  className="w-full px-4 py-3 border rounded-lg text-lg"
                  id="openingCash"
                />
              </div>
              <Button
                className="w-full"
                onClick={() => {
                  const input = document.getElementById('openingCash') as HTMLInputElement;
                  startShift(parseFloat(input.value) || 0);
                }}
              >
                Start Shift
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-gray-100 dark:bg-gray-900">
      {/* Header */}
      <header className="bg-white dark:bg-gray-800 shadow-sm px-4 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold">{moduleName}</h1>
            <span className="text-sm text-gray-500">
              {user?.fullName} | Shift started {formatTime((currentShift as any).actual_start || (currentShift as any).actualStart || (currentShift as any).start_time || currentShift.startTime)}
            </span>
          </div>

          {/* View Mode Tabs */}
          <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
            {[
              { mode: 'floor' as ViewMode, icon: LayoutGrid, label: 'Stations' },
              { mode: 'orders' as ViewMode, icon: UtensilsCrossed, label: 'Orders' },
              { mode: 'kitchen' as ViewMode, icon: ChefHat, label: 'Kitchen' },
              { mode: 'dispatch' as ViewMode, icon: Truck, label: 'Dispatch' },
              { mode: 'cashier' as ViewMode, icon: CreditCard, label: 'Cashier' },
              ...(requireReservation !== false
                ? [{ mode: 'floorplan' as ViewMode, icon: MapPin, label: 'Floor Map' }]
                : []),
            ].map(({ mode, icon: Icon, label }) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-4 py-2 rounded-md text-sm font-medium flex items-center gap-2 transition ${viewMode === mode
                    ? 'bg-primary text-white'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
              >
                <Icon className="h-4 w-4" />
                {label}
                {mode === 'orders' && orders.filter(o => o.status === 'pending').length > 0 && (
                  <span className="bg-red-500 text-white text-xs rounded-full px-2">
                    {orders.filter(o => o.status === 'pending').length}
                  </span>
                )}
                {mode === 'dispatch' && orders.filter(o => o.status === 'ready').length > 0 && (
                  <span className="bg-emerald-500 text-white text-xs rounded-full px-2">
                    {orders.filter(o => o.status === 'ready').length}
                  </span>
                )}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => setShowShiftModal(true)}>
              End Shift
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 overflow-hidden p-4">
        {/* Floor Plan View */}
        {viewMode === 'floor' && (
          <div className="h-full grid grid-cols-4 gap-4">
            {/* Tables Grid */}
            <div className="col-span-3 bg-white dark:bg-gray-800 rounded-xl p-4 overflow-y-auto">
              <div className="grid grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
                {tables.map(table => (
                  <button
                    key={table.id}
                    onClick={() => setSelectedTable(table)}
                    className={`aspect-square rounded-xl flex flex-col items-center justify-center p-4 transition ${table.status === 'available'
                        ? 'bg-green-100 dark:bg-green-900/30 border-2 border-green-500' :
                        table.status === 'occupied'
                          ? 'bg-red-100 dark:bg-red-900/30 border-2 border-red-500' :
                          table.status === 'reserved'
                            ? 'bg-yellow-100 dark:bg-yellow-900/30 border-2 border-yellow-500' :
                            'bg-gray-100 dark:bg-gray-700 border-2 border-gray-300'
                      }`}
                  >
                    <span className="text-2xl font-bold">{table.number}</span>
                    <span className="text-xs text-gray-500 mt-1">
                      {table.capacity} seats
                    </span>
                    {table.currentOrder && (
                      <span className="text-xs font-medium mt-2">
                        {formatCurrency(table.currentOrder.totalAmount)}
                      </span>
                    )}
                    {table.status === 'occupied' && table.currentOrder && (
                      <span className="text-xs text-gray-500">
                        {getOrderTime(table.currentOrder.createdAt)}m
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Selected Table Details */}
            <div className="bg-white dark:bg-gray-800 rounded-xl p-4 overflow-y-auto">
              {selectedTable ? (
                <div>
                  <h3 className="text-lg font-bold mb-4">Table {selectedTable.number}</h3>
                  {selectedTable.currentOrder ? (
                    <div className="space-y-4">
                      <div className="flex justify-between text-sm">
                        <span>Order #{selectedTable.currentOrder.orderNumber}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs ${selectedTable.currentOrder.status === 'ready' ? 'bg-green-100 text-green-800' :
                            'bg-blue-100 text-blue-800'
                          }`}>
                          {selectedTable.currentOrder.status}
                        </span>
                      </div>
                      <div className="space-y-2">
                        {selectedTable.currentOrder.items.map(item => (
                          <div key={item.id} className="flex justify-between text-sm">
                            <span>{item.quantity}x {item.name}</span>
                            <span>{formatCurrency(item.unitPrice * item.quantity)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="border-t pt-2 flex justify-between font-bold">
                        <span>Total</span>
                        <span>{formatCurrency(selectedTable.currentOrder.totalAmount)}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => { fetchMenuItems(); setShowItemPicker(true); }}
                        >
                          <Plus className="h-4 w-4 mr-1" /> Add Item
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => {
                            setSelectedOrder(selectedTable.currentOrder!);
                            setShowPaymentModal(true);
                          }}
                        >
                          <CreditCard className="h-4 w-4 mr-1" /> Pay
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center py-8">
                      <p className="text-gray-500 mb-4">Table is available</p>
                      <Button onClick={() => createNewOrder(selectedTable.id)}>New Order</Button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 text-gray-500">
                  Select a table to view details
                </div>
              )}
            </div>
          </div>
        )}

        {/* Orders View */}
        {viewMode === 'orders' && (
          <div className="h-full flex flex-col">
            {/* Filter Tabs */}
            <div className="flex gap-2 mb-4">
              {['active', 'pending', 'preparing', 'ready', 'completed'].map(filter => (
                <button
                  key={filter}
                  onClick={() => setStatusFilter(filter)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${statusFilter === filter
                      ? 'bg-primary text-white'
                      : 'bg-white dark:bg-gray-800 text-gray-600'
                    }`}
                >
                  {filter}
                  {filter === 'pending' && (
                    <span className="ml-2 bg-red-500 text-white text-xs rounded-full px-2">
                      {orders.filter(o => o.status === 'pending').length}
                    </span>
                  )}
                </button>
              ))}
            </div>

            {/* Orders Grid */}
            <div className="flex-1 overflow-y-auto">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {orders
                  .filter(o => statusFilter === 'active'
                    ? ['pending', 'confirmed', 'preparing', 'ready'].includes(o.status)
                    : o.status === statusFilter
                  )
                  .map(order => (
                    <Card
                      key={order.id}
                      className={`${order.status === 'pending' ? 'border-l-4 border-l-yellow-500' :
                          order.status === 'preparing' ? 'border-l-4 border-l-blue-500' :
                            order.status === 'ready' ? 'border-l-4 border-l-green-500 animate-pulse' :
                              ''
                        }`}
                    >
                      <CardHeader className="pb-2">
                        <div className="flex justify-between items-start">
                          <div>
                            <CardTitle className="text-lg">#{order.orderNumber}</CardTitle>
                            <p className="text-sm text-gray-500">
                              {order.tableNumber ? `Table ${order.tableNumber}` : order.orderType}
                            </p>
                          </div>
                          <div className="text-right">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${order.status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                                order.status === 'preparing' ? 'bg-blue-100 text-blue-800' :
                                  order.status === 'ready' ? 'bg-green-100 text-green-800' :
                                    'bg-gray-100 text-gray-800'
                              }`}>
                              {order.status}
                            </span>
                            <div className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                              <Timer className="h-3 w-3" />
                              {getOrderTime(order.createdAt)}m
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-1 mb-4 max-h-32 overflow-y-auto">
                          {order.items.map(item => (
                            <div key={item.id} className="flex justify-between text-sm">
                              <span className={item.status === 'ready' ? 'line-through text-gray-400' : ''}>
                                {item.quantity}x {item.name}
                              </span>
                              {item.notes && (
                                <span className="text-xs text-orange-500">⚠</span>
                              )}
                            </div>
                          ))}
                        </div>
                        <div className="flex justify-between items-center font-bold mb-4">
                          <span>Total</span>
                          <span>{formatCurrency(order.totalAmount)}</span>
                        </div>
                        <div className="flex gap-2">
                          {order.status === 'pending' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => updateOrderStatus(order.id, 'cancelled')}
                              >
                                <X className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => acceptOrder(order.id)}
                              >
                                <Check className="h-4 w-4 mr-1" /> Accept
                              </Button>
                            </>
                          )}
                          {order.status === 'confirmed' && (
                            <Button
                              size="sm"
                              className="w-full"
                              onClick={() => startPreparing(order.id)}
                            >
                              <Play className="h-4 w-4 mr-1" /> Start Prep
                            </Button>
                          )}
                          {order.status === 'preparing' && (
                            <Button
                              size="sm"
                              className="w-full bg-green-600 hover:bg-green-700"
                              onClick={() => markReady(order.id)}
                            >
                              <Bell className="h-4 w-4 mr-1" /> Mark Ready
                            </Button>
                          )}
                          {order.status === 'ready' && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1"
                                onClick={() => printReceipt(order.id)}
                              >
                                <Printer className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1"
                                onClick={() => {
                                  setSelectedOrder(order);
                                  setShowPaymentModal(true);
                                }}
                              >
                                <CreditCard className="h-4 w-4 mr-1" /> Pay
                              </Button>
                            </>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
              </div>
            </div>
          </div>
        )}

        {/* Kitchen Display View */}
        {viewMode === 'kitchen' && (
          <div className="h-full">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 h-full overflow-y-auto">
              {kitchenOrders.map(order => {
                const orderTime = getOrderTime(order.createdAt);
                const isUrgent = orderTime > 15;
                const isLate = orderTime > 20;

                return (
                  <Card
                    key={order.id}
                    className={`${isLate ? 'bg-red-50 dark:bg-red-900/20 border-red-500' :
                        isUrgent ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500' :
                          'bg-white dark:bg-gray-800'
                      } border-2`}
                  >
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <CardTitle className="text-xl font-mono">#{order.orderNumber}</CardTitle>
                        <div className={`flex items-center gap-1 px-2 py-1 rounded-lg text-lg font-bold ${isLate ? 'bg-red-500 text-white' :
                            isUrgent ? 'bg-yellow-500 text-white' :
                              'bg-gray-200 dark:bg-gray-700'
                          }`}>
                          <Timer className="h-5 w-5" />
                          {orderTime}m
                        </div>
                      </div>
                      <p className="text-sm text-gray-500">
                        {order.tableNumber ? `Table ${order.tableNumber}` : order.orderType}
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 mb-4">
                        {order.items.map(item => (
                          <div
                            key={item.id}
                            className={`p-2 rounded-lg ${item.status === 'ready'
                                ? 'bg-green-100 dark:bg-green-900/30 line-through'
                                : 'bg-gray-50 dark:bg-gray-700'
                              }`}
                          >
                            <div className="flex justify-between items-start">
                              <span className="font-bold text-lg">{item.quantity}x {item.name}</span>
                              {item.station && (
                                <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                  {item.station}
                                </span>
                              )}
                            </div>
                            {item.modifiers && item.modifiers.length > 0 && (
                              <p className="text-sm text-gray-600 mt-1">
                                + {item.modifiers.join(', ')}
                              </p>
                            )}
                            {item.notes && (
                              <p className="text-sm text-orange-600 mt-1 font-medium">
                                ⚠ {item.notes}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                      <Button
                        className={`w-full ${order.status === 'confirmed'
                            ? 'bg-blue-600 hover:bg-blue-700'
                            : 'bg-green-600 hover:bg-green-700'
                          }`}
                        onClick={() => {
                          if (order.status === 'confirmed') {
                            startPreparing(order.id);
                          } else {
                            markReady(order.id);
                          }
                        }}
                      >
                        {order.status === 'confirmed' ? (
                          <>
                            <Play className="h-5 w-5 mr-2" /> START
                          </>
                        ) : (
                          <>
                            <Bell className="h-5 w-5 mr-2" /> READY
                          </>
                        )}
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
              {kitchenOrders.length === 0 && (
                <div className="col-span-full flex items-center justify-center h-64">
                  <div className="text-center text-gray-500">
                    <ChefHat className="h-16 w-16 mx-auto mb-4 opacity-30" />
                    <p className="text-lg">No active orders</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Cashier View */}
        {viewMode === 'cashier' && (
          <div className="h-full grid grid-cols-3 gap-4">
            {/* Open Tabs */}
            <div className="col-span-2 bg-white dark:bg-gray-800 rounded-xl p-4 overflow-y-auto">
              <h3 className="text-lg font-bold mb-4">Open Tabs & Unpaid Orders</h3>
              <div className="space-y-3">
                {orders
                  .filter(o => ['ready', 'delivered'].includes(o.status))
                  .map(order => (
                    <div
                      key={order.id}
                      className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-700 rounded-lg"
                    >
                      <div>
                        <span className="font-bold">#{order.orderNumber}</span>
                        <span className="text-gray-500 ml-2">
                          {order.tableNumber ? `Table ${order.tableNumber}` : order.orderType}
                        </span>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className="font-bold text-lg">
                          {formatCurrency(order.totalAmount)}
                        </span>
                        <Button
                          onClick={() => {
                            setSelectedOrder(order);
                            setShowPaymentModal(true);
                          }}
                        >
                          <CreditCard className="h-4 w-4 mr-2" /> Settle
                        </Button>
                      </div>
                    </div>
                  ))}
              </div>
            </div>

            {/* Cash Drawer & Quick Actions */}
            <div className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <DollarSign className="h-5 w-5" />
                    Cash Drawer
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {(() => {
                    const cashSales = orders
                      .filter(o => (o.paymentStatus === 'paid' || o.status === 'completed') && (o.paymentMethod === 'cash' || o.paymentMethod === 'Cash'))
                      .reduce((sum, o) => sum + o.totalAmount, 0);
                    const cashIn = cashSales + cashTotals.cashIn;
                    const cashOut = cashTotals.cashOut;
                    const expectedCash = (currentShift.openingCash || 0) + cashIn - cashOut;
                    return (
                  <div className="space-y-2">
                    <div className="flex justify-between">
                      <span>Opening</span>
                      <span>{formatCurrency(currentShift.openingCash)}</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>Cash In</span>
                      <span>+{formatCurrency(cashIn)}</span>
                    </div>
                    <div className="flex justify-between text-red-600">
                      <span>Cash Out</span>
                      <span>-{formatCurrency(cashOut)}</span>
                    </div>
                    <div className="border-t pt-2 flex justify-between font-bold">
                      <span>Expected</span>
                      <span>{formatCurrency(expectedCash)}</span>
                    </div>
                  </div>
                    );
                  })()}
                  <div className="grid grid-cols-2 gap-2 mt-4">
                    <Button variant="outline" size="sm" onClick={() => { setCashModalType('in'); setShowCashModal(true); }}>Pay In</Button>
                    <Button variant="outline" size="sm" onClick={() => { setCashModalType('out'); setShowCashModal(true); }}>Pay Out</Button>
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Shift Summary</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span>Orders Processed</span>
                      <span className="font-bold">
                        {orders.filter(o => o.status === 'completed').length}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>Total Sales</span>
                      <span className="font-bold">
                        {formatCurrency(
                          orders
                            .filter(o => o.status === 'completed')
                            .reduce((sum, o) => sum + o.totalAmount, 0)
                        )}
                      </span>
                    </div>
                  </div>
                  <Button
                    className="w-full mt-4"
                    variant="outline"
                    onClick={() => setShowShiftModal(true)}
                  >
                    <Receipt className="h-4 w-4 mr-2" /> Z-Report & Close
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {viewMode === 'floorplan' && requireReservation !== false && (
          <ReservationFloorMap slug={moduleSlug} />
        )}

        {/* Dispatch View */}
        {viewMode === 'dispatch' && (
          <div className="h-full overflow-y-auto">
            <DispatchBoard slug={moduleSlug} moduleName={moduleName} moduleId={moduleId} />
          </div>
        )}
      </main>

      {/* Payment Modal */}
      {/* FIX Iter-20: payment modal a11y — role, aria-modal, aria-label, Escape handler */}
      {showPaymentModal && selectedOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="staff-payment-title" onKeyDown={(e) => { if (e.key === 'Escape') { setShowPaymentModal(false); setSelectedOrder(null); } }}>
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Process Payment</CardTitle>
              <p className="text-sm text-gray-500">
                Order #{selectedOrder.orderNumber} - {formatCurrency(selectedOrder.totalAmount)}
              </p>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {['card', 'cash', 'gift_card', 'split'].map(method => (
                  <button
                    key={method}
                    onClick={() => processPayment(selectedOrder.id, method, selectedOrder.totalAmount)}
                    className="w-full flex items-center gap-3 p-4 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                  >
                    {method === 'card' && <CreditCard className="h-5 w-5 text-primary" />}
                    {method === 'cash' && <DollarSign className="h-5 w-5 text-green-600" />}
                    {method === 'gift_card' && <Receipt className="h-5 w-5 text-purple-600" />}
                    {method === 'split' && <Split className="h-5 w-5 text-blue-600" />}
                    <span className="capitalize">{method.replace('_', ' ')}</span>
                  </button>
                ))}
              </div>
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => {
                  setShowPaymentModal(false);
                  setSelectedOrder(null);
                }}
              >
                Cancel
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

      {/* End Shift Modal */}
      {/* FIX Iter-20: end shift modal a11y — role, aria-modal, aria-label, Escape handler */}
      {showShiftModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby="staff-shift-title" onKeyDown={(e) => { if (e.key === 'Escape') setShowShiftModal(false); }}>
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>End Shift</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Actual Cash in Drawer</label>
                  <input
                    type="number"
                    placeholder="0.00"
                    className="w-full px-4 py-3 border rounded-lg text-lg"
                    id="closingCash"
                  />
                </div>
                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setShowShiftModal(false)}
                  >
                    Cancel
                  </Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      const input = document.getElementById('closingCash') as HTMLInputElement;
                      endShift(parseFloat(input.value) || 0);
                    }}
                  >
                    End Shift
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Cash Adjustment Modal (Pay In / Pay Out) */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={(e) => { if (e.key === 'Escape') setShowCashModal(false); }}>
          <Card className="max-w-sm w-full">
            <CardHeader>
              <CardTitle>{cashModalType === 'in' ? 'Pay In — Add Cash' : 'Pay Out — Remove Cash'}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Amount</label>
                  <input type="number" placeholder="0.00" min="0" step="0.01" className="w-full px-4 py-3 border rounded-lg text-lg" id="cashAmount" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-2">Note (optional)</label>
                  <input type="text" placeholder="Reason..." className="w-full px-3 py-2 border rounded-lg" id="cashNote" />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" className="flex-1" onClick={() => setShowCashModal(false)}>Cancel</Button>
                  <Button
                    className="flex-1"
                    onClick={() => {
                      const amount = parseFloat((document.getElementById('cashAmount') as HTMLInputElement).value) || 0;
                      const note = (document.getElementById('cashNote') as HTMLInputElement).value;
                      processCashAdjustment(cashModalType, amount, note);
                    }}
                  >
                    Confirm
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Item Picker Modal */}
      {showItemPicker && selectedTable?.currentOrder && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" role="dialog" aria-modal="true" onKeyDown={(e) => { if (e.key === 'Escape') setShowItemPicker(false); }}>
          <Card className="max-w-md w-full max-h-[80vh] overflow-y-auto">
            <CardHeader>
              <CardTitle>Add Item — Table {selectedTable.number}</CardTitle>
            </CardHeader>
            <CardContent>
              {menuItems.length === 0 ? (
                <p className="text-center text-gray-500 py-8">No menu items available</p>
              ) : (
                <div className="space-y-2">
                  {menuItems.map((item: any) => (
                    <button
                      key={item.id}
                      onClick={() => {
                        addItemToOrder(selectedTable.currentOrder!.id, { catalogItemId: item.id, quantity: 1 });
                        setShowItemPicker(false);
                      }}
                      className="w-full flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700"
                    >
                      <span className="font-medium">{item.name}</span>
                      <span className="text-primary font-semibold">{formatCurrency(item.price)}</span>
                    </button>
                  ))}
                </div>
              )}
              <Button variant="outline" className="w-full mt-4" onClick={() => setShowItemPicker(false)}>Cancel</Button>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
