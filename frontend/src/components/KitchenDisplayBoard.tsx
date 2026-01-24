'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import {
  Clock,
  ChefHat,
  Check,
  X,
  AlertTriangle,
  Volume2,
  VolumeX,
  Maximize2,
  RefreshCw,
  Timer,
  UtensilsCrossed,
  Bell,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Progress } from '@/components/ui/Progress';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/Dialog';
import { Textarea } from '@/components/ui/Textarea';
import { cn } from '@/lib/utils';
import { api } from '@/lib/api';
import { useSocket } from '@/hooks/useSocket';

interface OrderItem {
  id: string;
  name: string;
  quantity: number;
  modifications: string[];
  notes?: string;
  status: 'PENDING' | 'PREPARING' | 'READY' | 'SERVED';
  preparedAt?: string;
}

interface KitchenOrder {
  id: string;
  orderNumber: string;
  tableNumber: number;
  tableName: string;
  serverName: string;
  items: OrderItem[];
  priority: 'NORMAL' | 'RUSH' | 'VIP';
  status: 'PENDING' | 'IN_PROGRESS' | 'READY' | 'COMPLETED' | 'CANCELLED';
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  estimatedTime: number; // minutes
  notes?: string;
}

interface KitchenStats {
  pendingOrders: number;
  inProgressOrders: number;
  averageWaitTime: number;
  completedToday: number;
  rushOrders: number;
}

const PRIORITY_COLORS = {
  NORMAL: 'border-l-4 border-l-transparent',
  RUSH: 'border-l-4 border-l-orange-500',
  VIP: 'border-l-4 border-l-purple-500 bg-purple-50 dark:bg-purple-950/30',
};

const STATUS_COLORS = {
  PENDING: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
  IN_PROGRESS: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300',
  READY: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
  COMPLETED: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  CANCELLED: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300',
};

const ITEM_STATUS_COLORS = {
  PENDING: 'bg-gray-200 dark:bg-gray-700',
  PREPARING: 'bg-yellow-200 dark:bg-yellow-700',
  READY: 'bg-green-200 dark:bg-green-700',
  SERVED: 'bg-gray-200 dark:bg-gray-700',
};

export function KitchenDisplayBoard() {
  const t = useTranslations('kitchen');
  const socket = useSocket();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  
  const [orders, setOrders] = useState<KitchenOrder[]>([]);
  const [stats, setStats] = useState<KitchenStats>({
    pendingOrders: 0,
    inProgressOrders: 0,
    averageWaitTime: 0,
    completedToday: 0,
    rushOrders: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<KitchenOrder | null>(null);
  const [bumpNote, setBumpNote] = useState('');

  // Audio notification
  useEffect(() => {
    audioRef.current = new Audio('/sounds/kitchen-bell.mp3');
    audioRef.current.volume = 0.5;
  }, []);

  const playNotification = useCallback(() => {
    if (soundEnabled && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {});
    }
  }, [soundEnabled]);

  // Fetch orders
  const fetchOrders = useCallback(async () => {
    try {
      const [ordersRes, statsRes] = await Promise.all([
        api.get('/restaurant/kitchen/orders'),
        api.get('/restaurant/kitchen/stats'),
      ]);
      
      setOrders(ordersRes.data.data);
      setStats(statsRes.data.data);
    } catch (error) {
      console.error('Failed to fetch kitchen orders:', error);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(fetchOrders, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Socket listeners
  useEffect(() => {
    if (!socket) return;

    const handleNewOrder = (order: KitchenOrder) => {
      setOrders(prev => [order, ...prev]);
      setStats(prev => ({
        ...prev,
        pendingOrders: prev.pendingOrders + 1,
        rushOrders: order.priority === 'RUSH' ? prev.rushOrders + 1 : prev.rushOrders,
      }));
      playNotification();
      toast.info(`New order from Table ${order.tableNumber}`, {
        duration: 5000,
      });
    };

    const handleOrderUpdated = (updatedOrder: KitchenOrder) => {
      setOrders(prev =>
        prev.map(order =>
          order.id === updatedOrder.id ? updatedOrder : order
        )
      );
    };

    const handleOrderCancelled = (data: { orderId: string }) => {
      setOrders(prev =>
        prev.map(order =>
          order.id === data.orderId
            ? { ...order, status: 'CANCELLED' as const }
            : order
        )
      );
    };

    socket.on('kitchen:new-order', handleNewOrder);
    socket.on('kitchen:order-updated', handleOrderUpdated);
    socket.on('kitchen:order-cancelled', handleOrderCancelled);

    return () => {
      socket.off('kitchen:new-order', handleNewOrder);
      socket.off('kitchen:order-updated', handleOrderUpdated);
      socket.off('kitchen:order-cancelled', handleOrderCancelled);
    };
  }, [socket, playNotification]);

  // Start cooking an order
  const handleStartOrder = async (orderId: string) => {
    try {
      await api.post(`/restaurant/kitchen/orders/${orderId}/start`);
      toast.success('Order started');
    } catch (error) {
      toast.error('Failed to start order');
    }
  };

  // Mark item as prepared
  const handleItemReady = async (orderId: string, itemId: string) => {
    try {
      await api.post(`/restaurant/kitchen/orders/${orderId}/items/${itemId}/ready`);
    } catch (error) {
      toast.error('Failed to update item');
    }
  };

  // Bump order (mark as ready for pickup)
  const handleBumpOrder = async (order: KitchenOrder) => {
    setSelectedOrder(order);
  };

  const confirmBumpOrder = async () => {
    if (!selectedOrder) return;

    try {
      await api.post(`/restaurant/kitchen/orders/${selectedOrder.id}/ready`, {
        notes: bumpNote || undefined,
      });
      toast.success('Order ready for pickup!');
      playNotification();
      setSelectedOrder(null);
      setBumpNote('');
    } catch (error) {
      toast.error('Failed to bump order');
    }
  };

  // Toggle fullscreen
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  // Calculate elapsed time styling
  const getElapsedTimeColor = (createdAt: string, estimatedTime: number) => {
    const elapsed = (Date.now() - new Date(createdAt).getTime()) / 1000 / 60;
    const percentage = (elapsed / estimatedTime) * 100;

    if (percentage >= 100) return 'text-red-500 animate-pulse';
    if (percentage >= 75) return 'text-orange-500';
    return 'text-gray-500';
  };

  // Group orders by status
  const pendingOrders = orders.filter(o => o.status === 'PENDING');
  const inProgressOrders = orders.filter(o => o.status === 'IN_PROGRESS');
  const readyOrders = orders.filter(o => o.status === 'READY');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <RefreshCw className="h-12 w-12 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b">
        <div className="flex items-center gap-4">
          <ChefHat className="h-8 w-8 text-primary" />
          <h1 className="text-2xl font-bold">Kitchen Display</h1>
          <Badge variant="secondary" className="text-lg px-3 py-1">
            {new Date().toLocaleTimeString()}
          </Badge>
        </div>

        {/* Stats */}
        <div className="flex items-center gap-6 text-sm">
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 text-muted-foreground" />
            <span>Avg Wait: {stats.averageWaitTime} min</span>
          </div>
          <div className="flex items-center gap-2">
            <UtensilsCrossed className="h-4 w-4 text-muted-foreground" />
            <span>Today: {stats.completedToday}</span>
          </div>
          {stats.rushOrders > 0 && (
            <Badge variant="destructive" className="animate-pulse">
              {stats.rushOrders} Rush
            </Badge>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSoundEnabled(!soundEnabled)}
          >
            {soundEnabled ? (
              <Volume2 className="h-5 w-5" />
            ) : (
              <VolumeX className="h-5 w-5" />
            )}
          </Button>
          <Button variant="ghost" size="icon" onClick={toggleFullscreen}>
            <Maximize2 className="h-5 w-5" />
          </Button>
          <Button variant="ghost" size="icon" onClick={fetchOrders}>
            <RefreshCw className="h-5 w-5" />
          </Button>
        </div>
      </div>

      {/* Order Columns */}
      <div className="flex-1 grid grid-cols-3 gap-4 p-4 overflow-hidden">
        {/* Pending Orders */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <h2 className="text-lg font-semibold">Pending</h2>
            <Badge variant="secondary">{pendingOrders.length}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3">
            {pendingOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onStart={() => handleStartOrder(order.id)}
                onItemReady={handleItemReady}
                getElapsedTimeColor={getElapsedTimeColor}
              />
            ))}
          </div>
        </div>

        {/* In Progress */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-blue-500" />
            <h2 className="text-lg font-semibold">Cooking</h2>
            <Badge variant="secondary">{inProgressOrders.length}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3">
            {inProgressOrders.map(order => (
              <OrderCard
                key={order.id}
                order={order}
                onBump={() => handleBumpOrder(order)}
                onItemReady={handleItemReady}
                getElapsedTimeColor={getElapsedTimeColor}
              />
            ))}
          </div>
        </div>

        {/* Ready */}
        <div className="flex flex-col overflow-hidden">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-3 h-3 rounded-full bg-green-500" />
            <h2 className="text-lg font-semibold">Ready</h2>
            <Badge variant="secondary">{readyOrders.length}</Badge>
          </div>
          <div className="flex-1 overflow-y-auto space-y-3">
            {readyOrders.map(order => (
              <ReadyOrderCard key={order.id} order={order} />
            ))}
          </div>
        </div>
      </div>

      {/* Bump confirmation dialog */}
      <Dialog open={!!selectedOrder} onOpenChange={() => setSelectedOrder(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Bump Order #{selectedOrder?.orderNumber}</DialogTitle>
            <DialogDescription>
              Mark this order as ready for pickup. Add any notes for the server.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            placeholder="Optional notes for server..."
            value={bumpNote}
            onChange={(e) => setBumpNote(e.target.value)}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setSelectedOrder(null)}>
              Cancel
            </Button>
            <Button onClick={confirmBumpOrder}>
              <Bell className="mr-2 h-4 w-4" />
              Bump Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface OrderCardProps {
  order: KitchenOrder;
  onStart?: () => void;
  onBump?: () => void;
  onItemReady: (orderId: string, itemId: string) => void;
  getElapsedTimeColor: (createdAt: string, estimatedTime: number) => string;
}

function OrderCard({
  order,
  onStart,
  onBump,
  onItemReady,
  getElapsedTimeColor,
}: OrderCardProps) {
  const preparedCount = order.items.filter(
    item => item.status === 'READY' || item.status === 'SERVED'
  ).length;
  const progressPercentage = (preparedCount / order.items.length) * 100;

  return (
    <Card className={cn('relative', PRIORITY_COLORS[order.priority])}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">
            Table {order.tableNumber}
            <span className="text-sm font-normal text-muted-foreground ml-2">
              #{order.orderNumber}
            </span>
          </CardTitle>
          <div className="flex items-center gap-2">
            {order.priority !== 'NORMAL' && (
              <Badge
                variant={order.priority === 'RUSH' ? 'destructive' : 'secondary'}
                className="animate-pulse"
              >
                {order.priority}
              </Badge>
            )}
            <span className={cn('text-sm font-medium', getElapsedTimeColor(order.createdAt, order.estimatedTime))}>
              <Timer className="inline h-3 w-3 mr-1" />
              {formatDistanceToNow(new Date(order.createdAt))}
            </span>
          </div>
        </div>
        <div className="text-xs text-muted-foreground">
          Server: {order.serverName}
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {/* Items list */}
        <div className="space-y-2">
          {order.items.map(item => (
            <div
              key={item.id}
              className={cn(
                'flex items-center gap-2 p-2 rounded',
                ITEM_STATUS_COLORS[item.status]
              )}
            >
              <button
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center border-2',
                  item.status === 'READY' || item.status === 'SERVED'
                    ? 'bg-green-500 border-green-500 text-white'
                    : 'border-gray-400 hover:border-green-500'
                )}
                onClick={() => onItemReady(order.id, item.id)}
                disabled={item.status === 'READY' || item.status === 'SERVED'}
              >
                {(item.status === 'READY' || item.status === 'SERVED') && (
                  <Check className="h-4 w-4" />
                )}
              </button>
              <div className="flex-1">
                <div className="font-medium">
                  {item.quantity}x {item.name}
                </div>
                {item.modifications.length > 0 && (
                  <div className="text-xs text-orange-600">
                    {item.modifications.join(', ')}
                  </div>
                )}
                {item.notes && (
                  <div className="text-xs text-muted-foreground italic">
                    {item.notes}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Progress bar for in-progress orders */}
        {order.status === 'IN_PROGRESS' && (
          <Progress value={progressPercentage} className="h-2" />
        )}

        {/* Order notes */}
        {order.notes && (
          <div className="flex items-start gap-2 p-2 bg-yellow-100 dark:bg-yellow-900/30 rounded text-sm">
            <AlertTriangle className="h-4 w-4 text-yellow-600 flex-shrink-0 mt-0.5" />
            {order.notes}
          </div>
        )}

        {/* Action buttons */}
        <div className="flex gap-2">
          {onStart && order.status === 'PENDING' && (
            <Button className="flex-1" onClick={onStart}>
              <ChefHat className="mr-2 h-4 w-4" />
              Start Cooking
            </Button>
          )}
          {onBump && order.status === 'IN_PROGRESS' && progressPercentage === 100 && (
            <Button className="flex-1 bg-green-600 hover:bg-green-700" onClick={onBump}>
              <Bell className="mr-2 h-4 w-4" />
              Bump
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function ReadyOrderCard({ order }: { order: KitchenOrder }) {
  return (
    <Card className="bg-green-50 dark:bg-green-950/30 border-green-200 animate-pulse">
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-2xl font-bold text-green-700 dark:text-green-400">
              Table {order.tableNumber}
            </div>
            <div className="text-sm text-muted-foreground">
              #{order.orderNumber} • {order.items.length} items
            </div>
          </div>
          <div className="text-4xl">🔔</div>
        </div>
        {order.notes && (
          <div className="mt-2 text-sm text-green-700 dark:text-green-400">
            Note: {order.notes}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default KitchenDisplayBoard;
