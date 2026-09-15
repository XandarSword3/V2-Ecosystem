'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { formatCurrency, formatDate } from '@/lib/utils';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import {
  Package,
  Clock,
  ChevronDown,
  ChevronUp,
  CreditCard,
  Star,
  LifeBuoy,
  RotateCcw,
  RefreshCw,
  ExternalLink,
} from 'lucide-react';
import Link from 'next/link';

export interface OrderItemLine {
  id?: string;
  name?: string;
  title?: string;
  quantity?: number;
  qty?: number;
  price?: number;
  unit_price?: number;
}

export interface CustomerOrder {
  id: string;
  order_number?: string;
  module_name?: string;
  module_id?: string;
  status: string;
  fulfillment_status?: string;
  total_amount: number;
  currency?: string;
  payment_method?: string;
  created_at: string;
  items?: OrderItemLine[];
}

export interface OrdersHubProps {
  propertySlug?: string;
  className?: string;
  onNavigateTab?: (tab: string) => void;
}

export function OrdersHub({ propertySlug = '', className = '', onNavigateTab }: OrdersHubProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [orders, setOrders] = useState<CustomerOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedOrders, setExpandedOrders] = useState<Record<string, boolean>>({});

  const fetchOrders = async (signal?: AbortSignal) => {
    try {
      // Fetch customer transactions or orders
      const res = await api.get('/transactions/me', { signal }).catch(() => {
        // Fallback to customer profile statement/orders
        return api.get('/me/statement', { signal });
      });

      if (res.data?.success) {
        const list = Array.isArray(res.data.data) ? res.data.data : res.data.data?.orders || [];
        setOrders(list);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const controller = new AbortController();
      fetchOrders(controller.signal);
      return () => controller.abort();
    } else if (!authLoading && !isAuthenticated) {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated]);

  const toggleExpand = (orderId: string) => {
    setExpandedOrders((prev) => ({ ...prev, [orderId]: !prev[orderId] }));
  };

  const getFulfillmentBadge = (status: string) => {
    const s = status?.toLowerCase() || 'pending';
    switch (s) {
      case 'ready':
      case 'delivered':
      case 'handed_off':
      case 'completed':
        return <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 font-semibold">{s.toUpperCase()}</Badge>;
      case 'in_progress':
      case 'preparing':
      case 'in_transit':
        return <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300 font-semibold">{s.replace('_', ' ').toUpperCase()}</Badge>;
      case 'queued':
      case 'confirmed':
        return <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300 font-semibold">{s.toUpperCase()}</Badge>;
      case 'cancelled':
        return <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 font-semibold">CANCELLED</Badge>;
      default:
        return <Badge className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 font-semibold">{s.toUpperCase()}</Badge>;
    }
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]" data-testid="orders-loading">
        <RefreshCw className="w-8 h-8 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="text-center p-8 border-dashed" data-testid="orders-guest">
        <CardContent className="space-y-4">
          <Package className="w-12 h-12 text-primary-600 mx-auto" />
          <h2 className="text-xl font-bold text-foreground">Sign In to View Orders</h2>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            Log in to view past orders, track active deliveries, and manage receipts.
          </p>
          <Link
            href="/login"
            className="inline-flex items-center justify-center px-4 py-2 rounded-lg text-sm font-semibold bg-primary-600 hover:bg-primary-700 text-white transition-colors"
          >
            Sign In
          </Link>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className={`space-y-6 ${className}`} data-testid="orders-hub">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Package className="w-5 h-5 text-primary-600" />
            Orders & Transactions
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            Review past orders, view itemized receipts, and track fulfillment status.
          </p>
        </div>

        {onNavigateTab && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => onNavigateTab('tracking')}
            className="text-xs shrink-0"
            data-testid="live-tracking-link-btn"
          >
            <Clock className="w-3.5 h-3.5 mr-1.5 text-primary-600" />
            Live Fulfillment Tracking
          </Button>
        )}
      </div>

      {/* Orders List */}
      <Card className="border-slate-200 dark:border-slate-800">
        <CardContent className="p-4 sm:p-6">
          {orders.length === 0 ? (
            <div className="text-center py-12" data-testid="no-orders-msg">
              <Package className="w-12 h-12 text-slate-300 dark:text-slate-700 mx-auto mb-3" />
              <p className="text-base font-semibold text-foreground">No orders placed yet</p>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
                Explore our catalog and place your first order to track it live right here.
              </p>
            </div>
          ) : (
            <div className="space-y-4" data-testid="orders-list">
              {orders.map((order) => {
                const isExpanded = !!expandedOrders[order.id];
                const orderNum = order.order_number || `ORD-${order.id.slice(-8).toUpperCase()}`;
                const itemsCount = order.items?.length || 0;
                const status = order.fulfillment_status || order.status || 'pending';

                return (
                  <div
                    key={order.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm space-y-3"
                    data-testid={`order-card-${order.id}`}
                  >
                    {/* Header Row */}
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <span className="font-mono text-sm font-bold text-foreground" data-testid={`order-num-${order.id}`}>
                          #{orderNum}
                        </span>
                        {order.module_name && (
                          <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-slate-100 dark:bg-slate-800 text-muted-foreground">
                            {order.module_name}
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        {getFulfillmentBadge(status)}
                        <span className="font-mono font-bold text-sm text-foreground" data-testid={`order-amount-${order.id}`}>
                          {formatCurrency(order.total_amount || 0, order.currency || 'USD')}
                        </span>
                      </div>
                    </div>

                    {/* Metadata Row */}
                    <div className="flex flex-wrap items-center justify-between text-xs text-muted-foreground pt-1 border-t border-slate-100 dark:border-slate-800/80">
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5 text-slate-400" />
                        <span>{formatDate(order.created_at)}</span>
                        {order.payment_method && (
                          <span className="capitalize px-1.5 py-0.2 bg-slate-100 dark:bg-slate-800 rounded text-[10px]">
                            {order.payment_method}
                          </span>
                        )}
                      </div>

                      {/* Line items expansion button */}
                      {itemsCount > 0 && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(order.id)}
                          className="flex items-center gap-1 font-semibold text-primary-600 hover:text-primary-700 text-xs"
                          data-testid={`toggle-items-${order.id}`}
                        >
                          {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          <span>{isExpanded ? 'Hide Items' : `View ${itemsCount} Item(s)`}</span>
                        </button>
                      )}
                    </div>

                    {/* Expandable Itemized Breakdown */}
                    {isExpanded && order.items && (
                      <div className="mt-2 p-3 rounded-lg bg-slate-50 dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 space-y-2 text-xs" data-testid={`items-list-${order.id}`}>
                        {order.items.map((item, idx) => (
                          <div key={idx} className="flex justify-between items-center text-foreground">
                            <span>
                              {item.quantity || item.qty || 1}x {item.name || item.title || 'Item'}
                            </span>
                            <span className="font-mono font-medium">
                              {formatCurrency((item.price || item.unit_price || 0) * (item.quantity || item.qty || 1), order.currency || 'USD')}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Quick Action Footer */}
                    <div className="pt-2 flex flex-wrap items-center justify-end gap-2 border-t border-slate-100 dark:border-slate-800">
                      {propertySlug && (
                        <Link
                          href={`/${propertySlug}/order/${order.id}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-foreground"
                          data-testid={`track-btn-${order.id}`}
                        >
                          <ExternalLink className="w-3 h-3 text-primary-600" />
                          Track Live
                        </Link>
                      )}

                      {onNavigateTab && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onNavigateTab('reviews')}
                            className="text-xs px-2.5 py-1 text-amber-600 hover:text-amber-700"
                            data-testid={`review-order-btn-${order.id}`}
                          >
                            <Star className="w-3 h-3 mr-1 fill-amber-500 text-amber-500" />
                            Review
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onNavigateTab('recovery')}
                            className="text-xs px-2.5 py-1 text-blue-600 hover:text-blue-700"
                            data-testid={`issue-order-btn-${order.id}`}
                          >
                            <LifeBuoy className="w-3 h-3 mr-1" />
                            Report Issue
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default OrdersHub;
