'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { api } from '@/lib/api';
import { useSocket } from '@/lib/socket';
import { formatCurrency, formatDate, formatTime } from '@/lib/utils';
import type { FulfillmentMode } from '@/lib/engine-a/types';
import { canonicalFulfillmentState } from '@/types';
import { FulfillmentTimeline } from './FulfillmentTimeline';
import { FulfillmentSummary } from './FulfillmentSummary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  Clock,
  CheckCircle2,
  RefreshCw,
  Phone,
  ArrowLeft,
  Receipt,
  QrCode,
  AlertCircle,
  HelpCircle,
  ShoppingBag,
} from 'lucide-react';

export interface OrderTrackingProps {
  orderId: string;
  moduleSlug?: string;
  propertySlug?: string;
  token?: string;
  initialOrder?: any;
  className?: string;
}

/**
 * OrderTracking — Full Customer-Facing Live Fulfillment Tracking View (Plan F7).
 *
 * Consumes canonical backend fulfillment persistence and live WebSocket pushes,
 * rendering mode-appropriate timelines, fulfillment summaries, and QR verification.
 */
export function OrderTracking({
  orderId,
  moduleSlug,
  propertySlug,
  token,
  initialOrder,
  className = '',
}: OrderTrackingProps) {
  const t = useTranslations('checkout');
  const tCommon = useTranslations('common');
  const { socket, isConnected } = useSocket();

  const [order, setOrder] = useState<any>(initialOrder || null);
  const [loading, setLoading] = useState(!initialOrder);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch order data
  const fetchOrder = useCallback(
    async (isManualRefresh = false) => {
      if (isManualRefresh) setRefreshing(true);
      else if (!order) setLoading(true);
      setError(null);

      try {
        let endpoint = '';
        if (token) {
          endpoint = moduleSlug
            ? `/${moduleSlug}/public/orders/${orderId}/status?token=${encodeURIComponent(token)}`
            : `/public/orders/${orderId}/status?token=${encodeURIComponent(token)}`;
        } else {
          endpoint = moduleSlug ? `/${moduleSlug}/orders/${orderId}` : `/orders/${orderId}`;
        }

        const res = await api.get(endpoint);
        if (res?.data?.success && res?.data?.data) {
          setOrder(res.data.data);
        } else {
          setError(res?.data?.error || 'Order not found');
        }
      } catch (err: any) {
        setError(err?.response?.data?.error || err?.message || 'Failed to load order status');
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [orderId, moduleSlug, token]
  );

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  // Real-time WebSocket subscription to order room
  useEffect(() => {
    if (!socket || !isConnected || !orderId) return;

    // Join order-specific socket room
    socket.emit('order:join', { orderId });

    const handleStatusUpdate = (payload: any) => {
      if (!payload) return;
      const targetId = payload.id || payload.orderId;
      if (targetId && targetId === orderId) {
        setOrder((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            status: payload.status ?? prev.status,
            fulfillment_status:
              payload.fulfillmentStatus ?? payload.fulfillment_status ?? prev.fulfillment_status,
          };
        });
      }
    };

    socket.on('order:status', handleStatusUpdate);
    socket.on('order:updated', handleStatusUpdate);
    socket.on('fulfillment:updated', handleStatusUpdate);

    return () => {
      socket.off('order:status', handleStatusUpdate);
      socket.off('order:updated', handleStatusUpdate);
      socket.off('fulfillment:updated', handleStatusUpdate);
    };
  }, [socket, isConnected, orderId]);

  if (loading) {
    return (
      <div
        className={`max-w-2xl mx-auto p-6 space-y-6 ${className}`}
        data-testid="order-tracking-loading"
      >
        <div className="h-8 w-48 bg-muted/60 rounded-lg animate-pulse" />
        <div className="h-40 bg-muted/40 rounded-2xl animate-pulse" />
        <div className="h-64 bg-muted/30 rounded-2xl animate-pulse" />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div
        className={`max-w-md mx-auto p-6 text-center space-y-4 ${className}`}
        data-testid="order-tracking-error"
      >
        <div className="w-12 h-12 bg-destructive/10 text-destructive rounded-full flex items-center justify-center mx-auto">
          <AlertCircle className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-bold text-foreground">Failed to Track Order</h3>
        <p className="text-sm text-muted-foreground">{error || 'Order could not be located.'}</p>
        <Button onClick={() => fetchOrder(true)}>
          <RefreshCw className="w-4 h-4 mr-2" /> Try Again
        </Button>
      </div>
    );
  }

  // Derive canonical mode and states
  const rawMode: string =
    order.fulfillmentMode ||
    order.fulfillment_mode ||
    order.order_type ||
    'on_premise';

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
    canonicalFulfillmentState(order, canonicalMode) ?? order.fulfillment_status ?? order.status;

  const isCancelled = order.status === 'cancelled' || canonicalState === 'cancelled';
  const isCompleted = order.status === 'completed' || canonicalState === 'completed';

  const items = order.line_items || order.items || [];
  const currency = order.currency || 'USD';

  return (
    <div
      className={`max-w-2xl mx-auto space-y-6 ${className}`}
      data-testid="order-tracking-container"
    >
      {/* Top Header Card */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold bg-primary-100 dark:bg-primary-950/60 text-primary-700 dark:text-primary-300 px-2.5 py-0.5 rounded-full">
                #{order.order_number || (order.id ? order.id.slice(0, 8).toUpperCase() : '')}
              </span>
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                <span>Live Tracking</span>
              </div>
            </div>
            <CardTitle className="text-xl font-bold mt-1">
              {order.customer_name ? `Order for ${order.customer_name}` : 'Order Tracking'}
            </CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              Placed {order.created_at ? formatTime(order.created_at) : 'recently'} •{' '}
              {order.created_at ? formatDate(order.created_at) : ''}
            </p>
          </div>

          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchOrder(true)}
            disabled={refreshing}
            className="shrink-0"
            title="Refresh order status"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
          </Button>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {/* Fulfillment Summary Banner */}
          <FulfillmentSummary
            mode={canonicalMode}
            destinationType={order.destination_type}
            destinationRef={order.destination_ref || order.table_id || order.customer_address}
            fulfillmentStatus={canonicalState}
            estimatedReadyTime={order.estimated_ready_time}
            serviceLocationName={order.table_id ? `Table ${order.table_id}` : undefined}
          />

          {/* Fulfillment Timeline Progress */}
          <FulfillmentTimeline
            mode={canonicalMode}
            currentState={canonicalState}
            isCancelled={isCancelled}
            isCompleted={isCompleted}
            estimatedReadyTime={order.estimated_ready_time}
          />
        </CardContent>
      </Card>

      {/* QR Code Verification Modal / Card (if available) */}
      {order.qr_code && !isCancelled && (
        <Card className="text-center">
          <CardContent className="py-6 space-y-3">
            <h4 className="text-sm font-semibold text-foreground flex items-center justify-center gap-2">
              <QrCode className="w-4 h-4 text-primary-500" />
              Pickup & Verification QR Code
            </h4>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Present this QR code to staff at the counter, table, or delivery handoff for immediate verification.
            </p>
            <div className="inline-block p-4 rounded-xl bg-white shadow-inner border border-border">
              <img
                src={order.qr_code}
                alt="Order QR Code"
                className="w-44 h-44 mx-auto object-contain"
              />
            </div>
          </CardContent>
        </Card>
      )}

      {/* Itemized Order Summary */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Receipt className="w-4 h-4 text-primary-500" />
            Itemized Order Summary
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 divide-y divide-border/60">
          <div className="space-y-3 pt-1">
            {items.map((item: any, idx: number) => {
              const name = item.name || item.catalog_items?.name || 'Item';
              const qty = item.quantity || 1;
              const price = item.lineTotal ?? (item.unitPrice ? item.unitPrice * qty : 0);
              const modifiers = item.selectedModifiers || item.modifiers || [];

              return (
                <div key={idx} className="flex justify-between items-start text-sm">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-semibold px-1.5 py-0.5 rounded bg-muted text-muted-foreground">
                        {qty}x
                      </span>
                      <span className="font-medium text-foreground">{name}</span>
                    </div>
                    {modifiers.length > 0 && (
                      <div className="pl-7 flex flex-wrap gap-1">
                        {modifiers.map((m: any, mi: number) => (
                          <span
                            key={mi}
                            className="text-[11px] px-1.5 py-0.2 rounded bg-muted/60 text-muted-foreground"
                          >
                            +{m.optionName || m.name || m}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {price > 0 && (
                    <span className="font-medium text-foreground">{formatCurrency(price, currency)}</span>
                  )}
                </div>
              );
            })}
          </div>

          {/* Pricing breakdown */}
          <div className="pt-3 space-y-1.5 text-xs text-muted-foreground">
            {typeof order.subtotal === 'number' && (
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{formatCurrency(order.subtotal, currency)}</span>
              </div>
            )}
            {typeof order.discount_amount === 'number' && order.discount_amount > 0 && (
              <div className="flex justify-between text-emerald-600 dark:text-emerald-400">
                <span>Discounts</span>
                <span>-{formatCurrency(order.discount_amount, currency)}</span>
              </div>
            )}
            {typeof order.tax_amount === 'number' && order.tax_amount > 0 && (
              <div className="flex justify-between">
                <span>Taxes & Fees</span>
                <span>{formatCurrency(order.tax_amount, currency)}</span>
              </div>
            )}
            <div className="flex justify-between items-center text-sm font-bold text-foreground pt-1.5 border-t border-border/40">
              <span>Total Amount</span>
              <span className="text-base text-primary-600 dark:text-primary-400">
                {formatCurrency(order.total_amount, currency)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Navigation and Actions */}
      <div className="flex flex-col sm:flex-row gap-3 justify-between pt-2">
        {propertySlug && moduleSlug && (
          <Link href={`/${propertySlug}/${moduleSlug}`}>
            <Button variant="outline" className="w-full sm:w-auto">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Store
            </Button>
          </Link>
        )}
        {order.customer_phone && (
          <a href={`tel:${order.customer_phone}`} className="w-full sm:w-auto">
            <Button variant="ghost" className="w-full">
              <Phone className="w-4 h-4 mr-2" />
              Contact Support
            </Button>
          </a>
        )}
      </div>
    </div>
  );
}

export default OrderTracking;
