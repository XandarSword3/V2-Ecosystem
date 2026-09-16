'use client';

/**
 * F11 — Cross-module Products catalog.
 *
 * One generic catalog surface aggregating every module's products. Renders
 * the Phase 8 catalog dimensions as INDEPENDENT axes:
 *   - lifecycleStatus (business lifecycle decision)
 *   - isAvailable (operational quick-toggle)
 *   - isSellable (derived via the canonical rule — backend is authority)
 *
 * No vertical vocabulary: nothing here knows a product is food.
 */

import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Search,
  RefreshCw,
  ShoppingBag,
  CheckCircle2,
  PauseCircle,
  Archive,
  Pencil,
  PackageX,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/Skeleton';

// Phase 8 lifecycle model — mirrors backend modules/catalog/lifecycle.ts
type LifecycleStatus = 'draft' | 'active' | 'temporarily_unavailable' | 'sold_out' | 'archived';

const LIFECYCLE_META: Record<LifecycleStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-slate-100 text-slate-700 dark:bg-slate-700 dark:text-slate-300', icon: Pencil },
  active: { label: 'Active', color: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400', icon: CheckCircle2 },
  temporarily_unavailable: { label: 'Paused', color: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400', icon: PauseCircle },
  sold_out: { label: 'Sold Out', color: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400', icon: PackageX },
  archived: { label: 'Archived', color: 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-500', icon: Archive },
};

interface CatalogItem {
  id: string;
  module: { slug: string; name: string } | null;
  name: string;
  description: string | null;
  price: number | string;
  currency: string;
  lifecycleStatus: LifecycleStatus;
  isAvailable: boolean;
  isSellable: boolean;
}

interface CatalogResponse {
  items: CatalogItem[];
  modules: Array<{ slug: string; name: string; engineType: string }>;
}

export default function AdminProductsPage() {
  const t = useTranslations('admin');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [moduleFilter, setModuleFilter] = useState('all');
  const [lifecycleFilter, setLifecycleFilter] = useState('all');

  // Debounce search input
  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-cross-catalog', moduleFilter, lifecycleFilter],
    queryFn: async (): Promise<CatalogResponse> => {
      const params: Record<string, string | number> = { limit: 1000 };
      if (lifecycleFilter !== 'all') params.lifecycle_status = lifecycleFilter;
      if (moduleFilter !== 'all') params.module = moduleFilter;
      const res = await api.get('/admin/catalog', { params });
      return res.data?.data ?? { items: [], modules: [] };
    },
    staleTime: 30_000,
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const modules = useMemo(() => data?.modules ?? [], [data]);

  const filtered = useMemo(() => {
    if (!search) return items;
    const term = search.toLowerCase();
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(term) ||
        (i.description || '').toLowerCase().includes(term),
    );
  }, [items, search]);

  // Summary counts (Phase 8 lifecycle-aware)
  const counts = useMemo(() => {
    const c = { total: items.length, sellable: 0, paused: 0, off: 0 };
    for (const i of items) {
      if (i.isSellable) c.sellable++;
      else if (i.lifecycleStatus === 'active' && !i.isAvailable) c.paused++;
      else c.off++;
    }
    return c;
  }, [items]);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[...Array(3)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
        <CardSkeleton />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <ShoppingBag className="w-6 h-6 text-orange-500" />
            {t('nav.products') || 'Products'}
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Catalog across all modules — lifecycle and availability are independent dimensions.
          </p>
        </div>
        <button
          onClick={() => refetch()}
          className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">Sellable now</p>
          <p className="text-2xl font-bold text-green-600 dark:text-green-400">{counts.sellable}</p>
          <p className="text-xs text-slate-400">active + available</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">Paused (86&apos;d)</p>
          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">{counts.paused}</p>
          <p className="text-xs text-slate-400">active, availability off</p>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
          <p className="text-xs uppercase tracking-wide text-slate-400">Off-sale</p>
          <p className="text-2xl font-bold text-slate-600 dark:text-slate-300">{counts.off}</p>
          <p className="text-xs text-slate-400">draft / sold out / archived</p>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
            />
          </div>
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="all">All Modules</option>
            {modules.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name}</option>
            ))}
          </select>
          <select
            value={lifecycleFilter}
            onChange={(e) => setLifecycleFilter(e.target.value)}
            className="px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
          >
            <option value="all">All Lifecycle States</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="temporarily_unavailable">Temporarily Unavailable</option>
            <option value="sold_out">Sold Out</option>
            <option value="archived">Archived</option>
          </select>
        </div>
      </div>

      {/* Catalog grid */}
      {isError ? (
        <div className="text-center py-12 text-slate-500 dark:text-slate-400">
          Failed to load catalog. Check your permissions and try again.
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <ShoppingBag className="w-10 h-10 mx-auto text-slate-300 mb-3" />
          <p className="text-slate-500 dark:text-slate-400">No products found</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((item) => {
            const meta = LIFECYCLE_META[item.lifecycleStatus] ?? LIFECYCLE_META.active;
            const LifecycleIcon = meta.icon;
            return (
              <div
                key={item.id}
                className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 dark:text-white truncate">{item.name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5">{item.module?.name || 'Unknown module'}</p>
                  </div>
                  <span className="font-bold text-slate-900 dark:text-white whitespace-nowrap">
                    {formatCurrency(Number(item.price), item.currency || undefined)}
                  </span>
                </div>

                {item.description && (
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 line-clamp-2">{item.description}</p>
                )}

                {/* Independent Phase 8 dimensions */}
                <div className="flex flex-wrap items-center gap-2 mt-3">
                  <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${meta.color}`}>
                    <LifecycleIcon className="w-3 h-3" />
                    {meta.label}
                  </span>
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${
                      item.isAvailable
                        ? 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
                        : 'bg-gray-100 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
                    }`}
                  >
                    {item.isAvailable ? 'Available' : 'Availability Off'}
                  </span>
                  {item.isSellable && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400">
                      Sellable
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
