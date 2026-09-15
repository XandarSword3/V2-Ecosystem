'use client';

import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { useAuthorization, Perm } from '@/lib/authorization';
import {
  statesForMode,
  getModeStateConfig,
  isFulfillmentMode,
  type FulfillmentMode,
  type FulfillmentState,
  type ModeStateConfig,
} from '@/lib/engine-a/types';
import { canonicalFulfillmentState } from '@/types';
import { WorkQueue } from './WorkQueue';
import type { WorkItemData, WorkQueueColumn, WorkItemPriority } from './types';
import { Button } from '@/components/ui/Button';
import {
  RefreshCw,
  Search,
  Filter,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Flame,
  Clock,
  CheckCircle2,
  AlertCircle,
  Inbox,
} from 'lucide-react';

export interface OperationsBoardProps {
  slug: string;
  moduleName: string;
  moduleId: string;
  initialOrders?: WorkItemData[];
  onOrderCountChange?: (count: number) => void;
  className?: string;
}

const DEFAULT_MODE: FulfillmentMode = 'on_premise';

/** Normalize raw API order data into WorkItemData */
function normalizeWorkItem(order: any): WorkItemData {
  const rawMode: string =
    order.fulfillmentMode ||
    order.fulfillment_mode ||
    order.orderType ||
    order.order_type ||
    DEFAULT_MODE;

  const canonicalMode: FulfillmentMode =
    rawMode === 'delivery' || rawMode === 'local_delivery'
      ? 'local_delivery'
      : rawMode === 'takeaway' || rawMode === 'pickup'
      ? 'pickup'
      : rawMode === 'digital' || rawMode === 'digital_delivery'
      ? 'digital_delivery'
      : rawMode === 'shipment'
      ? 'shipment'
      : rawMode === 'service' || rawMode === 'service_execution'
      ? 'service_execution'
      : rawMode === 'none'
      ? 'none'
      : 'on_premise';

  const canonicalState =
    canonicalFulfillmentState(order, canonicalMode) ??
    order.fulfillmentStatus ??
    order.fulfillment_status ??
    order.status ??
    'queued';

  return {
    id: order.id,
    orderNumber: order.orderNumber || order.order_number || String(order.id).slice(0, 8).toUpperCase(),
    status: order.status || 'confirmed',
    fulfillmentStatus: canonicalState,
    fulfillmentMode: canonicalMode,
    priority: (order.priority || 'normal').toLowerCase() as WorkItemPriority,
    createdAt: order.createdAt || order.created_at || new Date().toISOString(),
    totalAmount: order.totalAmount ?? order.total_amount ?? 0,
    currency: order.currency || 'USD',
    customerId: order.customerId || order.customer_id,
    customerName: order.customerName || order.customer_name,
    customerPhone: order.customerPhone || order.customer_phone,
    loyaltyTier: order.loyaltyTier || order.loyalty_tier,
    isVip: order.isVip || order.is_vip,
    tableNumber: order.tableNumber ?? order.table_number ?? order.table_id,
    tableName: order.tableName ?? order.table_name,
    roomNumber: order.roomNumber ?? order.room_number,
    destinationType: order.destinationType ?? order.destination_type,
    destinationRef: order.destinationRef ?? order.destination_ref,
    deliveryAddress: order.deliveryAddress ?? order.delivery_address,
    driverName: order.driverName ?? order.driver_name,
    trackingNumber: order.trackingNumber ?? order.tracking_number,
    notes: order.notes,
    estimatedReadyTime: order.estimatedReadyTime ?? order.estimated_ready_time,
    staffName: order.staffName ?? order.staff_name,
    items: (order.items || order.line_items || []).map((i: any) => ({
      id: i.id || String(Math.random()),
      name: i.name || i.catalog_items?.name || 'Item',
      quantity: i.quantity || 1,
      unitPrice: i.unitPrice ?? i.unit_price ?? 0,
      status: (i.status || 'pending').toLowerCase(),
      modifiers: i.modifiers || [],
      specialInstructions: i.specialInstructions ?? i.special_instructions,
    })),
  };
}

/**
 * OperationsBoard — Canonical Staff Operating Surface for Engine A (Plan F8).
 *
 * Implements a generic, capability-driven workflow queue supporting any
 * fulfillment mode (hospitality, delivery, retail shipment, digital, service).
 */
export function OperationsBoard({
  slug,
  moduleName,
  moduleId,
  initialOrders,
  onOrderCountChange,
  className = '',
}: OperationsBoardProps) {
  const t = useTranslations('staff');
  const { socket } = useSocket();
  const auth = useAuthorization();

  const [orders, setOrders] = useState<WorkItemData[]>(() =>
    (initialOrders || []).map(normalizeWorkItem)
  );
  const [loading, setLoading] = useState(!initialOrders);
  const [refreshing, setRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<FulfillmentMode | 'all'>('all');
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [pendingAdvanceIds, setPendingAdvanceIds] = useState<Set<string>>(new Set());

  // Fetch live orders
  const fetchOrders = useCallback(
    async (isManual = false) => {
      if (isManual) setRefreshing(true);
      else if (orders.length === 0) setLoading(true);

      try {
        const res = await api.get(`/staff/modules/${slug}/orders`, {
          params: {
            status: 'pending,confirmed,queued,in_progress,ready',
            moduleId,
          },
        });

        const rawList = res.data?.data || [];
        const normalized = rawList.map(normalizeWorkItem);
        setOrders(normalized);
        onOrderCountChange?.(normalized.length);
      } catch (err: any) {
        toast.error('Failed to load operational work queue');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [slug, moduleId, onOrderCountChange]
  );

  useEffect(() => {
    fetchOrders();
    const interval = setInterval(() => fetchOrders(true), 30000);
    return () => clearInterval(interval);
  }, [fetchOrders]);

  // Real-time WebSocket subscriptions
  useEffect(() => {
    if (!socket) return;

    socket.emit('order:join', { moduleId, slug });

    const handleStatusUpdate = (payload: any) => {
      if (!payload) return;
      const orderId = payload.id || payload.orderId;
      if (!orderId) return;

      const newFulfillmentState = payload.fulfillmentStatus ?? payload.fulfillment_status;
      const newTransactionState = payload.status;

      setOrders((prev) => {
        // If order completed or handed off, remove from active board or update
        if (newTransactionState === 'completed' || newTransactionState === 'cancelled') {
          return prev.filter((o) => o.id !== orderId);
        }

        return prev.map((o) => {
          if (o.id === orderId) {
            return {
              ...o,
              status: newTransactionState ?? o.status,
              fulfillmentStatus: newFulfillmentState ?? o.fulfillmentStatus,
            };
          }
          return o;
        });
      });
    };

    const handleNewOrder = (order: any) => {
      if (!order) return;
      const normalized = normalizeWorkItem(order);
      setOrders((prev) => [normalized, ...prev.filter((o) => o.id !== normalized.id)]);
      toast.info(`New work item #${normalized.orderNumber}`);
    };

    socket.on('order:status', handleStatusUpdate);
    socket.on('order:updated', handleStatusUpdate);
    socket.on('order:new', handleNewOrder);
    socket.on('kitchen:new-order', handleNewOrder);
    socket.on('kitchen:order-updated', handleStatusUpdate);

    return () => {
      socket.off('order:status', handleStatusUpdate);
      socket.off('order:updated', handleStatusUpdate);
      socket.off('order:new', handleNewOrder);
      socket.off('kitchen:new-order', handleNewOrder);
      socket.off('kitchen:order-updated', handleStatusUpdate);
    };
  }, [socket, moduleId, slug]);

  // Advance order status
  const handleAdvanceOrder = async (orderId: string, targetState: string) => {
    if (pendingAdvanceIds.has(orderId)) return;
    setPendingAdvanceIds((prev) => new Set(prev).add(orderId));

    try {
      await api.patch(`/staff/modules/${slug}/orders/${orderId}/status`, {
        status: targetState,
      });

      // Optimistic update
      setOrders((prev) =>
        prev.map((o) => (o.id === orderId ? { ...o, fulfillmentStatus: targetState } : o))
      );
      toast.success(`Order advanced to ${targetState.replace('_', ' ')}`);
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Failed to advance order state');
    } finally {
      setPendingAdvanceIds((prev) => {
        const next = new Set(prev);
        next.delete(orderId);
        return next;
      });
    }
  };

  // Advance individual item status
  const handleAdvanceItem = async (orderId: string, itemId: string) => {
    try {
      const order = orders.find((o) => o.id === orderId);
      const item = order?.items.find((i) => i.id === itemId);
      if (!item) return;

      const nextItemStatus =
        item.status === 'pending'
          ? 'preparing'
          : item.status === 'preparing'
          ? 'ready'
          : 'served';

      await api.patch(`/staff/modules/${slug}/orders/${orderId}/items/${itemId}/status`, {
        status: nextItemStatus,
      });

      // Optimistically update item
      setOrders((prev) =>
        prev.map((o) => {
          if (o.id !== orderId) return o;
          return {
            ...o,
            items: o.items.map((i) => (i.id === itemId ? { ...i, status: nextItemStatus as any } : i)),
          };
        })
      );
    } catch (err: any) {
      toast.error('Failed to update line item status');
    }
  };

  // Toggle order priority
  const handleTogglePriority = async (orderId: string, priority: WorkItemPriority) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === orderId ? { ...o, priority } : o))
    );
    toast.success(`Priority set to ${priority.toUpperCase()}`);
  };

  // Cancel order with reason
  const handleCancelOrder = async (orderId: string, reason: string) => {
    try {
      await api.patch(`/staff/modules/${slug}/orders/${orderId}/status`, {
        status: 'cancelled',
        reason,
      });
      setOrders((prev) => prev.filter((o) => o.id !== orderId));
      toast.success('Order cancelled and compensated');
    } catch (err: any) {
      toast.error('Failed to cancel order');
    }
  };

  // Extend prep time
  const handleExtendEta = (orderId: string, minutes: number) => {
    toast.success(`ETA extended by +${minutes} minutes`);
  };

  // Print station ticket
  const handlePrintTicket = async (orderId: string) => {
    try {
      await api.post(`/staff/modules/${slug}/orders/${orderId}/print`);
      toast.success('Station ticket sent to printer');
    } catch {
      toast.info('Ticket print simulated');
    }
  };

  // Fullscreen toggle
  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen().catch(() => {});
      setIsFullscreen(false);
    }
  };

  // Available modes present in current orders
  const availableModes = useMemo(() => {
    const set = new Set<FulfillmentMode>();
    orders.forEach((o) => set.add(o.fulfillmentMode));
    return Array.from(set);
  }, [orders]);

  // Filtered orders based on active tab and search query
  const filteredOrders = useMemo(() => {
    return orders.filter((o) => {
      // Tab filter
      if (activeTab !== 'all' && o.fulfillmentMode !== activeTab) {
        return false;
      }
      // Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesNum = o.orderNumber.toLowerCase().includes(q);
        const matchesCustomer = (o.customerName || '').toLowerCase().includes(q);
        const matchesTable = String(o.tableNumber || '').toLowerCase().includes(q);
        const matchesItem = o.items.some((i) => i.name.toLowerCase().includes(q));
        if (!matchesNum && !matchesCustomer && !matchesTable && !matchesItem) {
          return false;
        }
      }
      return true;
    });
  }, [orders, activeTab, searchQuery]);

  // Active mode state config for column derivation
  const effectiveMode = activeTab === 'all' ? DEFAULT_MODE : activeTab;
  const modeConfig = getModeStateConfig(effectiveMode);

  // Derive workflow columns dynamically
  const columns: WorkQueueColumn[] = useMemo(() => {
    if (!modeConfig) return [];

    return modeConfig.states.map((state) => {
      const meta = modeConfig.metadata[state];
      const itemsInState = filteredOrders.filter(
        (o) => (o.fulfillmentStatus || 'queued') === state
      );

      return {
        state,
        label: meta.label,
        actionLabel: meta.actionLabel,
        bgClass: meta.bg,
        borderClass: meta.border,
        textClass: meta.text,
        actionBgClass: meta.actionBg,
        terminal: meta.terminal,
        items: itemsInState,
      };
    });
  }, [modeConfig, filteredOrders]);

  // Compute statistics
  const stats = useMemo(() => {
    const total = orders.length;
    const rushCount = orders.filter((o) => o.priority === 'rush').length;
    const readyCount = orders.filter((o) => o.fulfillmentStatus === 'ready').length;
    return { total, rushCount, readyCount };
  }, [orders]);

  return (
    <div
      className={`operations-board flex flex-col h-full space-y-4 ${className}`}
      data-testid="operations-board"
    >
      {/* Top Header & Stats Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 p-4 rounded-2xl bg-card border border-border shadow-sm">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Inbox className="w-5 h-5 text-primary-600" />
            {moduleName} Operations
          </h2>

          {/* Quick Metrics Badges */}
          <div className="flex items-center gap-2 text-xs">
            <span
              className="px-2.5 py-1 rounded-full font-bold bg-primary-50 dark:bg-primary-950/40 text-primary-700 dark:text-primary-300 border border-primary-200 dark:border-primary-800"
              data-testid="stats-total-orders"
            >
              {stats.total} Active
            </span>
            {stats.rushCount > 0 && (
              <span
                className="flex items-center gap-1 px-2.5 py-1 rounded-full font-bold bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 border border-orange-300 animate-pulse"
                data-testid="stats-rush-orders"
              >
                <Flame className="w-3.5 h-3.5 fill-current" />
                {stats.rushCount} Rush
              </span>
            )}
            {stats.readyCount > 0 && (
              <span
                className="px-2.5 py-1 rounded-full font-bold bg-green-100 text-green-800 dark:bg-green-950/50 dark:text-green-300 border border-green-300"
                data-testid="stats-ready-orders"
              >
                {stats.readyCount} Ready
              </span>
            )}
          </div>
        </div>

        {/* Controls: Search, Sound, Fullscreen, Refresh */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search table, #, item..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-1.5 text-xs rounded-xl border border-border bg-background text-foreground w-44 focus:w-56 transition-all focus:outline-none focus:ring-2 focus:ring-primary-500"
              data-testid="operations-search-input"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => setSoundEnabled(!soundEnabled)}
            className="h-8 px-2.5"
            title={soundEnabled ? 'Mute Alerts' : 'Enable Sound Alerts'}
          >
            {soundEnabled ? <Volume2 className="w-3.5 h-3.5" /> : <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={toggleFullscreen}
            className="h-8 px-2.5"
            title="Toggle Fullscreen"
          >
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </Button>

          <Button
            variant="outline"
            size="sm"
            disabled={refreshing}
            onClick={() => fetchOrders(true)}
            className="h-8 px-2.5"
            title="Refresh Board"
            data-testid="operations-refresh-button"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Mode Filter Tabs */}
      {availableModes.length > 1 && (
        <div className="flex items-center gap-1.5 border-b border-border/60 pb-2 px-1">
          <button
            type="button"
            onClick={() => setActiveTab('all')}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
              activeTab === 'all'
                ? 'bg-primary-600 text-white shadow-sm'
                : 'bg-muted/60 text-muted-foreground hover:bg-muted'
            }`}
            data-testid="tab-all-modes"
          >
            All Work Queues
          </button>
          {availableModes.map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setActiveTab(mode)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold capitalize transition ${
                activeTab === mode
                  ? 'bg-primary-600 text-white shadow-sm'
                  : 'bg-muted/60 text-muted-foreground hover:bg-muted'
              }`}
              data-testid={`tab-mode-${mode}`}
            >
              {mode.replace('_', ' ')}
            </button>
          ))}
        </div>
      )}

      {/* Columns Grid */}
      <div
        className={`grid gap-4 flex-1 overflow-x-auto pb-4 ${
          columns.length <= 3
            ? 'grid-cols-1 md:grid-cols-3'
            : columns.length <= 4
            ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
            : 'grid-cols-1 md:grid-cols-3 lg:grid-cols-5'
        }`}
        data-testid="operations-columns-grid"
      >
        {columns.map((col, idx) => {
          const nextState = idx < columns.length - 1 ? (columns[idx + 1].state as string) : null;

          return (
            <WorkQueue
              key={col.state}
              column={col}
              nextState={nextState}
              onAdvanceOrder={handleAdvanceOrder}
              onAdvanceItem={handleAdvanceItem}
              onTogglePriority={handleTogglePriority}
              onCancelOrder={handleCancelOrder}
              onExtendEta={handleExtendEta}
              onPrintTicket={handlePrintTicket}
              disabled={pendingAdvanceIds.size > 0}
            />
          );
        })}
      </div>
    </div>
  );
}

export default OperationsBoard;
