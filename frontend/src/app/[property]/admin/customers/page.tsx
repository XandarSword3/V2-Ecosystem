'use client';

/**
 * F11 — Cross-module Customers capability view.
 *
 * One unified customer surface aggregating customers of the property with
 * transaction aggregates across ALL engine types (from the canonical
 * transactions table). No per-module forks; no vertical vocabulary.
 */

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { Search, RefreshCw, Users, ShoppingBag, Coins, Clock } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/Skeleton';

interface UnifiedCustomer {
  id: string;
  name: string;
  email: string | null;
  createdAt: string;
  orderCount: number;
  lifetimeValue: number;
  lastOrderAt: string | null;
}

interface CustomersResponse {
  customers: UnifiedCustomer[];
  total: number;
}

export default function AdminCustomersPage() {
  const t = useTranslations('admin');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-cross-customers', search],
    queryFn: async (): Promise<CustomersResponse> => {
      const params: Record<string, string | number> = { limit: 200 };
      if (search) params.search = search;
      const res = await api.get('/admin/customers', { params });
      return res.data.data;
    },
    staleTime: 60_000,
  });

  const customers = data?.customers ?? [];
  const total = data?.total ?? 0;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Users className="w-6 h-6" />
            {t('nav.customers')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('nav.customersSubtitle')}
          </p>
        </div>
        <button
          onClick={() => refetch()}
          disabled={isFetching}
          className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
          aria-label="Refresh"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={t('nav.searchCustomers')}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
        />
      </div>

      {/* Content */}
      {isLoading ? (
        <CardSkeleton />
      ) : isError ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
          {t('nav.failedToLoad')}
        </div>
      ) : customers.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <Users className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">{t('nav.noCustomersFound')}</p>
        </div>
      ) : (
        <>
          <p className="text-xs text-slate-400">
            {total} {total === 1 ? 'customer' : 'customers'}
          </p>
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {customers.map((c) => (
              <div
                key={c.id}
                className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 hover:shadow-sm transition-shadow"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium text-slate-900 dark:text-white truncate">{c.name}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
                      {c.email || '—'}
                    </p>
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <div>
                    <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                      <ShoppingBag className="w-3 h-3" /> {t('nav.orders')}
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {c.orderCount}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                      <Coins className="w-3 h-3" /> {t('nav.lifetimeValue')}
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {formatCurrency(c.lifetimeValue)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs text-slate-400 flex items-center justify-center gap-1">
                      <Clock className="w-3 h-3" /> {t('nav.lastOrder')}
                    </p>
                    <p className="text-sm font-semibold text-slate-900 dark:text-white">
                      {c.lastOrderAt ? new Date(c.lastOrderAt).toLocaleDateString() : '—'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
