'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useAuth } from '@/lib/auth-context';
import { useSocket } from '@/lib/socket';
import { formatCurrency, formatTime, getOrderStatusColor } from '@/lib/utils';
import { api } from '@/lib/api';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/Card';
import {
  UtensilsCrossed,
  Clock,
  CheckCircle,
  ChefHat,
  Bell,
  RefreshCw,
  User,
  LogOut,
  LogIn,
  XCircle,
  Timer,
  LayoutDashboard,
  Calendar,
  Ticket,
  Users,
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

const statusFlow = ['pending', 'confirmed', 'preparing', 'ready', 'completed'];

function SessionAccessDashboard({ slug, moduleName }: { slug: string, moduleName: string }) {
  return (
    <div className="space-y-6 p-6">
      <header className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
          <Ticket className="h-8 w-8 text-primary" />
          {moduleName} Management
        </h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">
          Manage sessions, tickets, and capacity.
        </p>
      </header>
      
      <div className="grid gap-6 md:grid-cols-3">
        <Link href={`/staff/modules/${slug}/sessions`} className="block group">
          <Card className="h-full transition-all group-hover:shadow-lg group-hover:border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="w-5 h-5 text-blue-500" />
                Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">Manage daily sessions and time slots.</p>
            </CardContent>
          </Card>
        </Link>

        <Link href={`/staff/modules/${slug}/tickets`} className="block group">
          <Card className="h-full transition-all group-hover:shadow-lg group-hover:border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Ticket className="w-5 h-5 text-green-500" />
                Tickets
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">Scan and validate tickets.</p>
            </CardContent>
          </Card>
        </Link>
        
        <Link href={`/staff/modules/${slug}/capacity`} className="block group">
          <Card className="h-full transition-all group-hover:shadow-lg group-hover:border-primary">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="w-5 h-5 text-purple-500" />
                Capacity
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-500">View real-time occupancy and stats.</p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}

function MultiDayBookingDashboard({ slug, moduleName, moduleId }: { slug: string, moduleName: string, moduleId: string }) {
  const [bookings, setBookings] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'today' | 'all'>('today');
  const [selectedBooking, setSelectedBooking] = useState<any | null>(null);
  const { socket } = useSocket();

  const fetchBookings = useCallback(async () => {
    try {
      const response = await api.get('/chalets/staff/bookings', {
        params: { 
          moduleId,
          ...(filter === 'today' ? { date: new Date().toISOString().split('T')[0] } : {})
        },
      });
      setBookings(response.data.data || []);
    } catch (error) {
      toast.error('Failed to load bookings');
    } finally {
      setLoading(false);
    }
  }, [moduleId, filter]);

  useEffect(() => {
    fetchBookings();
  }, [fetchBookings]);

  useEffect(() => {
    if (socket && moduleId) {
      socket.emit('join:unit', moduleId);
      socket.on('booking:new', fetchBookings);
      socket.on('booking:updated', fetchBookings);
      return () => {
        socket.off('booking:new', fetchBookings);
        socket.off('booking:updated', fetchBookings);
      };
    }
  }, [socket, moduleId, fetchBookings]);

  const updateBookingStatus = async (bookingId: string, status: string) => {
    try {
      await api.patch(`/chalets/staff/bookings/${bookingId}/status`, { status });
      setBookings((prev) => prev.map((b) => (b.id === bookingId ? { ...b, status } : b)));
      toast.success(`Booking ${status.replace('_', ' ')}`);
      setSelectedBooking(null);
    } catch (error) {
      toast.error('Failed to update booking');
    }
  };

  const statusConfig: Record<string, { color: string; label: string }> = {
    pending: { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
    confirmed: { color: 'bg-blue-100 text-blue-800', label: 'Confirmed' },
    checked_in: { color: 'bg-green-100 text-green-800', label: 'Checked In' },
    checked_out: { color: 'bg-slate-100 text-slate-800', label: 'Checked Out' },
    cancelled: { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4 md:p-6">
      <header className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white flex items-center gap-3">
            <LayoutDashboard className="h-8 w-8 text-primary" />
            {moduleName} Bookings
          </h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage check-ins, check-outs, and bookings
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white dark:bg-gray-800 rounded-lg shadow-sm">
            <button
              onClick={() => setFilter('today')}
              className={`px-4 py-2 text-sm font-medium rounded-l-lg transition ${
                filter === 'today' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setFilter('all')}
              className={`px-4 py-2 text-sm font-medium rounded-r-lg transition ${
                filter === 'all' ? 'bg-primary text-white' : 'text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700'
              }`}
            >
              All
            </button>
          </div>
          <Button variant="outline" size="icon" onClick={fetchBookings}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Check-ins Today</p>
                <p className="text-2xl font-bold">{bookings.filter((b) => b.status === 'confirmed').length}</p>
              </div>
              <LogIn className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Check-outs Today</p>
                <p className="text-2xl font-bold">{bookings.filter((b) => b.status === 'checked_in').length}</p>
              </div>
              <LogOut className="w-8 h-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-2xl font-bold">{bookings.filter((b) => b.status === 'pending').length}</p>
              </div>
              <Clock className="w-8 h-8 text-yellow-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Total Bookings</p>
                <p className="text-2xl font-bold">{bookings.length}</p>
              </div>
              <Calendar className="w-8 h-8 text-purple-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Bookings List */}
      {bookings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Calendar className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">No bookings {filter === 'today' ? 'for today' : 'found'}</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {bookings.map((booking) => (
            <Card key={booking.id} className="cursor-pointer hover:shadow-lg transition" onClick={() => setSelectedBooking(booking)}>
              <CardContent className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <h3 className="font-semibold text-lg">#{booking.booking_number}</h3>
                    <p className="text-sm text-gray-500">{booking.users?.full_name || booking.customer_name || 'Guest'}</p>
                  </div>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusConfig[booking.status]?.color || 'bg-gray-100'}`}>
                    {statusConfig[booking.status]?.label || booking.status}
                  </span>
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-gray-600">
                    <Calendar className="w-4 h-4" />
                    <span>{formatTime(booking.check_in_date)} - {formatTime(booking.check_out_date)}</span>
                  </div>
                  <div className="flex items-center gap-2 text-gray-600">
                    <Users className="w-4 h-4" />
                    <span>{booking.guests || booking.number_of_guests || 1} guests</span>
                  </div>
                </div>
                <div className="mt-4 pt-3 border-t flex gap-2">
                  {booking.status === 'confirmed' && (
                    <Button size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); updateBookingStatus(booking.id, 'checked_in'); }}>
                      <LogIn className="w-4 h-4 mr-1" /> Check In
                    </Button>
                  )}
                  {booking.status === 'checked_in' && (
                    <Button size="sm" variant="outline" className="flex-1" onClick={(e) => { e.stopPropagation(); updateBookingStatus(booking.id, 'checked_out'); }}>
                      <LogOut className="w-4 h-4 mr-1" /> Check Out
                    </Button>
                  )}
                  {booking.status === 'pending' && (
                    <Button size="sm" className="flex-1" onClick={(e) => { e.stopPropagation(); updateBookingStatus(booking.id, 'confirmed'); }}>
                      <CheckCircle className="w-4 h-4 mr-1" /> Confirm
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Modal */}
      {selectedBooking && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setSelectedBooking(null)}>
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl font-semibold">Booking #{selectedBooking.booking_number}</h3>
              <Button variant="ghost" size="icon" onClick={() => setSelectedBooking(null)}><XCircle className="w-5 h-5" /></Button>
            </div>
            <div className="space-y-3">
              <div className="flex justify-between"><span className="text-gray-500">Guest</span><span>{selectedBooking.users?.full_name || selectedBooking.customer_name}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Check-in</span><span>{formatTime(selectedBooking.check_in_date)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Check-out</span><span>{formatTime(selectedBooking.check_out_date)}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Guests</span><span>{selectedBooking.guests || selectedBooking.number_of_guests || 1}</span></div>
              <div className="flex justify-between"><span className="text-gray-500">Total</span><span className="font-bold">{formatCurrency(selectedBooking.total_amount || 0)}</span></div>
              {selectedBooking.special_requests && (
                <div className="bg-yellow-50 p-3 rounded"><span className="font-medium">Notes:</span> {selectedBooking.special_requests}</div>
              )}
            </div>
            <div className="mt-6 flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setSelectedBooking(null)}>Close</Button>
              {selectedBooking.status === 'confirmed' && <Button className="flex-1" onClick={() => updateBookingStatus(selectedBooking.id, 'checked_in')}>Check In</Button>}
              {selectedBooking.status === 'checked_in' && <Button className="flex-1" onClick={() => updateBookingStatus(selectedBooking.id, 'checked_out')}>Check Out</Button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KitchenView({ slug, moduleName, moduleId }: { slug: string, moduleName: string, moduleId: string }) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedStatus, setSelectedStatus] = useState<string | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const { socket } = useSocket();

  // Load initial orders
  useEffect(() => {
    loadOrders();
  }, [moduleId]);

  // Real-time updates
  useEffect(() => {
    if (socket && moduleId) {
      socket.emit('join:unit', moduleId); 
      socket.emit('join:unit', slug);

      const handleNewOrder = (newOrder: any) => {
        setOrders((prev) => [newOrder, ...prev]);
        toast.info(`New order #${newOrder.orderNumber}`, {
          description: newOrder.customerName,
        });
        const audio = new Audio('/notification.mp3');
        audio.play().catch(() => {});
      };

      const handleStatusUpdate = (update: any) => {
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
        socket.off('order:new', handleNewOrder);
        socket.off('order:status', handleStatusUpdate);
        socket.off('new-order', handleNewOrder);
        socket.off('order-status-updated', handleStatusUpdate);
      };
    }
  }, [socket, moduleId, slug]);

  const loadOrders = async () => {
    try {
      const response = await api.get('/restaurant/staff/orders', {
        params: { 
          status: 'pending,confirmed,preparing,ready',
          moduleId: moduleId 
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
      await api.patch(`/restaurant/staff/orders/${orderId}/status`, {
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

  const filteredOrders = selectedStatus
    ? orders.filter((order) => order.status === selectedStatus)
    : orders;

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
          <Button variant="outline" size="icon" onClick={loadOrders}>
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </header>

      {/* Status Filters */}
      <div className="flex overflow-x-auto pb-4 gap-2 mb-6 scrollbar-hide">
        <Button
          variant={selectedStatus === null ? 'primary' : 'outline'}
          onClick={() => setSelectedStatus(null)}
          className="whitespace-nowrap"
        >
          All Orders ({orders.length})
        </Button>
        {statusFlow.map((status) => (
          <Button
            key={status}
            variant={selectedStatus === status ? 'primary' : 'outline'}
            onClick={() => setSelectedStatus(status)}
            className="whitespace-nowrap capitalize"
          >
            {status} ({orders.filter((o) => o.status === status).length})
          </Button>
        ))}
      </div>

      {/* Orders Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {filteredOrders.length === 0 ? (
          <div className="col-span-full flex flex-col items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            <UtensilsCrossed className="h-16 w-16 mb-4 opacity-20" />
            <p className="text-lg font-medium">No active orders</p>
            <p className="text-sm">New orders will appear here automatically</p>
          </div>
        ) : (
          filteredOrders.map((order) => (
            <div
              key={order.id}
              className={`bg-white dark:bg-gray-800 rounded-xl shadow-sm border-l-4 overflow-hidden transition-all hover:shadow-md ${
                selectedOrder?.id === order.id ? 'ring-2 ring-primary' : ''
              }`}
              style={{ borderLeftColor: getOrderStatusColor(order.status) }}
              onClick={() => setSelectedOrder(order)}
            >
              <div className="p-4">
                <div className="flex justify-between items-start mb-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-lg">#{order.orderNumber}</span>
                      {order.tableNumber && (
                        <span className="bg-gray-100 dark:bg-gray-700 px-2 py-0.5 rounded text-xs font-medium">
                          T-{order.tableNumber}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-gray-500 dark:text-gray-400 mt-1">
                      <Clock className="h-3 w-3" />
                      <span>{formatTime(order.createdAt)}</span>
                    </div>
                  </div>
                  <span
                    className="px-2 py-1 rounded-full text-xs font-medium capitalize"
                    style={{
                      backgroundColor: `${getOrderStatusColor(order.status)}20`,
                      color: getOrderStatusColor(order.status),
                    }}
                  >
                    {order.status}
                  </span>
                </div>

                <div className="space-y-2 mb-4">
                  {order.items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <div className="flex gap-2">
                        <span className="font-medium w-6 text-center bg-gray-100 dark:bg-gray-700 rounded">
                          {item.quantity}x
                        </span>
                        <span className="text-gray-700 dark:text-gray-300">
                          {item.name}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {order.items.some((i) => i.specialInstructions) && (
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-2 rounded text-xs text-yellow-800 dark:text-yellow-200 mb-3">
                    <span className="font-bold">Note:</span>{' '}
                    {order.items.find((i) => i.specialInstructions)?.specialInstructions}
                  </div>
                )}

                <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
                  <div className="flex items-center gap-2 text-sm text-gray-500">
                    <User className="h-4 w-4" />
                    <span className="truncate max-w-[100px]">
                      {order.customerName}
                    </span>
                  </div>
                  <div className="font-bold text-primary">
                    {formatCurrency(order.totalAmount)}
                  </div>
                </div>
              </div>

              {/* Quick Actions */}
              <div className="bg-gray-50 dark:bg-gray-800/50 p-2 flex gap-2">
                {order.status === 'pending' && (
                  <Button
                    className="w-full bg-green-600 hover:bg-green-700 text-white"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateOrderStatus(order.id, 'confirmed');
                    }}
                  >
                    Accept
                  </Button>
                )}
                {order.status === 'confirmed' && (
                  <Button
                    className="w-full bg-blue-600 hover:bg-blue-700 text-white"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateOrderStatus(order.id, 'preparing');
                    }}
                  >
                    Start Prep
                  </Button>
                )}
                {order.status === 'preparing' && (
                  <Button
                    className="w-full bg-orange-500 hover:bg-orange-600 text-white"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateOrderStatus(order.id, 'ready');
                    }}
                  >
                    Mark Ready
                  </Button>
                )}
                {order.status === 'ready' && (
                  <Button
                    className="w-full bg-gray-600 hover:bg-gray-700 text-white"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      updateOrderStatus(order.id, 'completed');
                    }}
                  >
                    Complete
                  </Button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Order Details Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 backdrop-blur-sm">
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

export default function ModulePage({ params }: { params: { slug: string } }) {
  const slug = params.slug;
  const [moduleId, setModuleId] = useState<string | null>(null);
  const [moduleName, setModuleName] = useState<string>('');
  const [templateType, setTemplateType] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchModule = async () => {
      try {
        const response = await api.get(`/admin/modules/${slug}`);
        if (response.data.success) {
            setModuleId(response.data.data.id);
            setModuleName(response.data.data.name);
            setTemplateType(response.data.data.template_type);
        }
      } catch (error) {
        console.error('Failed to fetch module:', error);
        toast.error('Failed to load module details');
      } finally {
        setIsLoading(false);
      }
    };

    fetchModule();
  }, [slug]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
         <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!moduleId) {
      return (
          <div className="min-h-screen flex items-center justify-center">
              <p className="text-gray-500">Module not found.</p>
          </div>
      );
  }

  if (templateType === 'menu_service') {
      return <KitchenView slug={slug} moduleName={moduleName} moduleId={moduleId} />;
  }

  if (templateType === 'session_access') {
      return <SessionAccessDashboard slug={slug} moduleName={moduleName} />;
  }
  
  if (templateType === 'multi_day_booking') {
       return <MultiDayBookingDashboard slug={slug} moduleName={moduleName} moduleId={moduleId} />;
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
        <p className="text-gray-500">Unsupported Module Type: {templateType}</p>
    </div>
  );
}
