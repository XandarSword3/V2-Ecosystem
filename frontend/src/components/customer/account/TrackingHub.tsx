'use client';

import React, { useState, useEffect } from 'react';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth-context';
import { OrderTracking } from '@/components/customer/OrderTracking';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Clock, Package, Search, RefreshCw, ArrowRight } from 'lucide-react';
import { formatDate } from '@/lib/utils';

export interface TrackingHubProps {
  propertySlug?: string;
  initialOrderId?: string;
  className?: string;
}

export function TrackingHub({ propertySlug = '', initialOrderId = '', className = '' }: TrackingHubProps) {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [selectedOrderId, setSelectedOrderId] = useState<string>(initialOrderId);
  const [recentOrders, setRecentOrders] = useState<Array<{ id: string; order_number?: string; created_at: string; status: string }>>([]);
  const [searchInput, setSearchInput] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const controller = new AbortController();
      api
        .get('/transactions/me', { signal: controller.signal })
        .then((res) => {
          if (res.data?.success) {
            const list = res.data.data || [];
            setRecentOrders(list.slice(0, 5));
            if (!selectedOrderId && list.length > 0) {
              setSelectedOrderId(list[0].id);
            }
          }
        })
        .catch(() => {})
        .finally(() => setLoading(false));

      return () => controller.abort();
    } else {
      setLoading(false);
    }
  }, [authLoading, isAuthenticated, selectedOrderId]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchInput.trim()) {
      setSelectedOrderId(searchInput.trim());
    }
  };

  return (
    <div className={`space-y-6 ${className}`} data-testid="tracking-hub">
      {/* Lookup & Selector Bar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 shadow-sm">
        <form onSubmit={handleSearch} className="flex items-center gap-2 flex-1 max-w-md">
          <Input
            type="text"
            placeholder="Enter Order ID or reference..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            className="text-xs"
            data-testid="tracking-search-input"
          />
          <Button type="submit" size="sm" className="shrink-0 text-xs" data-testid="tracking-search-btn">
            <Search className="w-3.5 h-3.5 mr-1" />
            Track
          </Button>
        </form>

        {recentOrders.length > 1 && (
          <div className="flex items-center gap-1.5 overflow-x-auto text-xs scrollbar-none">
            <span className="text-muted-foreground shrink-0 font-medium">Recent:</span>
            {recentOrders.map((ord) => (
              <button
                key={ord.id}
                type="button"
                onClick={() => setSelectedOrderId(ord.id)}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors shrink-0 ${
                  selectedOrderId === ord.id
                    ? 'bg-primary-600 text-white font-bold'
                    : 'bg-slate-100 dark:bg-slate-800 text-foreground hover:bg-slate-200'
                }`}
              >
                #{ord.order_number || ord.id.slice(-6).toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Live Order Tracking Component */}
      {selectedOrderId ? (
        <OrderTracking
          orderId={selectedOrderId}
          propertySlug={propertySlug}
          data-testid="active-order-tracking"
        />
      ) : (
        <Card className="text-center p-8 border-slate-200 dark:border-slate-800">
          <CardContent className="space-y-3">
            <Package className="w-10 h-10 text-slate-400 mx-auto" />
            <h3 className="font-bold text-sm text-foreground">No active order selected</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Select one of your recent orders or enter an order confirmation ID above to view live fulfillment progress.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default TrackingHub;
