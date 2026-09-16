'use client';

/**
 * F13 — Product economics.
 *
 * One surface for per-product unit economics across the property's modules:
 * revenue → BOM cost → COGS → margin, plus waste cost. Data comes from the
 * backend `/admin/economics/products` endpoint (the backend is the only
 * calculator — this page never derives costs client-side).
 *
 * Products without a BOM show "No recipe" for COGS/margin: the backend sends
 * null rather than a fake number, and this page must not invent one either.
 */

import { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import {
  Search,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Receipt,
  Scissors,
  AlertTriangle,
  Scale,
} from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/Skeleton';

interface ProductEconomics {
  catalogItemId: string;
  name: string;
  price: number | null;
  unitsSold: number;
  revenue: number;
  cogs: number | null;
  cogsPerUnit: number | null;
  margin: number | null;
  marginPct: number | null;
  hasBom: boolean;
}

interface EconomicsTotals {
  revenue: number;
  cogs: number;
  margin: number;
  marginPct: number | null;
  wasteCost: number;
}

interface WasteEntry {
  itemId: string;
  name: string;
  quantity: number;
  cost: number;
}

interface IngredientVariance {
  inventoryItemId: string;
  name: string;
  unit: string;
  unitsSold: number;
  theoretical: number;
  actual: number;
  variance: number;
  variancePct: number | null;
  varianceCost: number;
  flagged: boolean;
}

interface VarianceResponse {
  ingredients: IngredientVariance[];
  totals: { shrinkageCost: number; flaggedCount: number; trackedCount: number };
  windowDays: number;
}

interface EconomicsResponse {
  products: ProductEconomics[];
  totals: EconomicsTotals;
  waste: WasteEntry[];
  windowDays: number;
}

const WINDOWS = [
  { days: 7, label: '7d' },
  { days: 30, label: '30d' },
  { days: 90, label: '90d' },
  { days: 365, label: '1y' },
];

export default function AdminEconomicsPage() {
  const t = useTranslations('admin');

  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [days, setDays] = useState(30);

  useEffect(() => {
    const id = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(id);
  }, [searchInput]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-product-economics', days],
    queryFn: async (): Promise<EconomicsResponse> => {
      const res = await api.get('/admin/economics/products', { params: { days } });
      return res.data?.data ?? { products: [], totals: { revenue: 0, cogs: 0, margin: 0, marginPct: null, wasteCost: 0 }, waste: [], windowDays: days };
    },
    staleTime: 60_000,
  });

  const { data: variance, isLoading: varianceLoading } = useQuery({
    queryKey: ['admin-ingredient-variance', days],
    queryFn: async (): Promise<VarianceResponse> => {
      const res = await api.get('/admin/economics/variance', { params: { days } });
      return res.data?.data ?? { ingredients: [], totals: { shrinkageCost: 0, flaggedCount: 0, trackedCount: 0 }, windowDays: days };
    },
    staleTime: 60_000,
  });

  const products = useMemo(() => data?.products ?? [], [data]);
  const totals = data?.totals;

  const filtered = useMemo(() => {
    if (!search) return products;
    const term = search.toLowerCase();
    return products.filter((p) => p.name.toLowerCase().includes(term));
  }, [products, search]);

  // Highest-impact first: sold products with known margin, then by revenue.
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      if (a.unitsSold !== b.unitsSold) return b.unitsSold - a.unitsSold;
      return b.revenue - a.revenue;
    });
  }, [filtered]);

  const missingBom = useMemo(
    () => products.filter((p) => p.unitsSold > 0 && !p.hasBom).length,
    [products],
  );

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
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
            <TrendingUp className="w-6 h-6 text-emerald-500" />
            Product Economics
          </h1>
          <p className="text-slate-500 dark:text-slate-400 mt-1">
            Revenue, cost of goods, and margin per product — computed from bills of materials.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-slate-200 dark:border-slate-700 overflow-hidden">
            {WINDOWS.map((w) => (
              <button
                key={w.days}
                onClick={() => setDays(w.days)}
                className={`px-3 py-2 text-sm transition-colors ${
                  days === w.days
                    ? 'bg-emerald-500 text-white'
                    : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <button
            onClick={() => refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      {isError ? (
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
          <p className="text-red-700 dark:text-red-400">Failed to load product economics.</p>
        </div>
      ) : (
        <>
          {/* Totals */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">Revenue</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(totals?.revenue ?? 0)}
              </p>
              <p className="text-xs text-slate-400">last {data?.windowDays ?? days} days</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">COGS</p>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">
                {formatCurrency(totals?.cogs ?? 0)}
              </p>
              <p className="text-xs text-slate-400">bill-of-materials cost</p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">Gross margin</p>
              <p className={`text-2xl font-bold ${(totals?.margin ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {formatCurrency(totals?.margin ?? 0)}
              </p>
              <p className="text-xs text-slate-400">
                {totals?.marginPct != null ? `${totals.marginPct.toFixed(1)}% margin` : 'partial BOM coverage'}
              </p>
            </div>
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-5">
              <p className="text-xs uppercase tracking-wide text-slate-400">Waste cost</p>
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                {formatCurrency(totals?.wasteCost ?? 0)}
              </p>
              <p className="text-xs text-slate-400">not in COGS</p>
            </div>
          </div>

          {/* BOM coverage nudge */}
          {missingBom > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <p className="text-sm text-amber-800 dark:text-amber-300">
                {missingBom} product{missingBom === 1 ? '' : 's'} sold have no recipe (BOM) configured — their margin is unknown.
                Add ingredients under Resources → Inventory to see their costs.
              </p>
            </div>
          )}

          {/* Filters */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 p-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="w-full pl-10 pr-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
              />
            </div>
          </div>

          {/* Product table */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Units sold</th>
                    <th className="px-4 py-3 text-right">Revenue</th>
                    <th className="px-4 py-3 text-right">COGS</th>
                    <th className="px-4 py-3 text-right">Margin</th>
                    <th className="px-4 py-3 text-right">Margin %</th>
                  </tr>
                </thead>
                <tbody>
                  {sorted.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-400">
                        No products {search ? 'match your search' : 'with sales in this window'}.
                      </td>
                    </tr>
                  ) : (
                    sorted.map((p) => (
                      <tr
                        key={p.catalogItemId}
                        className="border-b border-slate-100 dark:border-slate-700/50 last:border-0 hover:bg-slate-50 dark:hover:bg-slate-700/30"
                      >
                        <td className="px-4 py-3">
                          <div className="font-medium text-slate-900 dark:text-white">{p.name}</div>
                          {p.price != null && (
                            <div className="text-xs text-slate-400">list {formatCurrency(p.price)}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{p.unitsSold}</td>
                        <td className="px-4 py-3 text-right text-slate-900 dark:text-white">
                          {formatCurrency(p.revenue)}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                          {p.cogs != null ? (
                            formatCurrency(p.cogs)
                          ) : (
                            <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400">
                              <Scissors className="w-3 h-3" /> No recipe
                            </span>
                          )}
                        </td>
                        <td className={`px-4 py-3 text-right font-medium ${p.margin == null ? 'text-slate-400' : p.margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                          {p.margin != null ? (
                            <span className="inline-flex items-center gap-1">
                              {p.margin >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                              {formatCurrency(p.margin)}
                            </span>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">
                          {p.marginPct != null ? `${p.marginPct.toFixed(1)}%` : '—'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Waste */}
          {data && data.waste.length > 0 && (
            <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
              <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
                <Receipt className="w-4 h-4 text-amber-500" />
                <h2 className="font-semibold text-slate-900 dark:text-white">Waste (last {data.windowDays} days)</h2>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-slate-700/50 text-left text-xs uppercase tracking-wide text-slate-400">
                    <th className="px-4 py-2">Item</th>
                    <th className="px-4 py-2 text-right">Quantity</th>
                    <th className="px-4 py-2 text-right">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {data.waste.map((w) => (
                    <tr key={w.itemId} className="border-b border-slate-100 dark:border-slate-700/50 last:border-0">
                      <td className="px-4 py-2 text-slate-900 dark:text-white">{w.name}</td>
                      <td className="px-4 py-2 text-right text-slate-600 dark:text-slate-300">{w.quantity}</td>
                      <td className="px-4 py-2 text-right text-amber-600 dark:text-amber-400">{formatCurrency(w.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Variance: actual vs theoretical consumption (F13) */}
          <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex flex-wrap items-center gap-2">
              <Scale className="w-4 h-4 text-sky-500" />
              <h2 className="font-semibold text-slate-900 dark:text-white">Consumption variance</h2>
              <span className="text-xs text-slate-400">actual ledger usage vs recipe theory — sorted by cost impact</span>
            </div>
            {varianceLoading ? (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">Computing variance…</div>
            ) : !variance || variance.ingredients.length === 0 ? (
              <div className="px-4 py-8 text-center text-slate-400 text-sm">
                No consumption tracked in this window — variance appears once recipes and deductions exist.
              </div>
            ) : (
              <>
                {variance.totals.flaggedCount > 0 && (
                  <div className="px-4 py-3 bg-amber-50 dark:bg-amber-900/20 border-b border-amber-100 dark:border-amber-900/40 text-sm text-amber-800 dark:text-amber-300">
                    {variance.totals.flaggedCount} ingredient{variance.totals.flaggedCount === 1 ? '' : 's'} deviate ≥10% from theory — worth a physical count and portioning check.
                  </div>
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-slate-200 dark:border-slate-700 text-left text-xs uppercase tracking-wide text-slate-400">
                        <th className="px-4 py-3">Ingredient</th>
                        <th className="px-4 py-3 text-right">Theoretical</th>
                        <th className="px-4 py-3 text-right">Actual</th>
                        <th className="px-4 py-3 text-right">Variance</th>
                        <th className="px-4 py-3 text-right">Cost impact</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variance.ingredients.map((v) => (
                        <tr
                          key={v.inventoryItemId}
                          className={`border-b border-slate-100 dark:border-slate-700/50 last:border-0 ${v.flagged ? 'bg-amber-50/50 dark:bg-amber-900/10' : ''}`}
                        >
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-900 dark:text-white flex items-center gap-1.5">
                              {v.name}
                              {v.flagged && <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />}
                            </div>
                            <div className="text-xs text-slate-400">{v.unitsSold} product units sold</div>
                          </td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{v.theoretical} {v.unit}</td>
                          <td className="px-4 py-3 text-right text-slate-600 dark:text-slate-300">{v.actual} {v.unit}</td>
                          <td className={`px-4 py-3 text-right font-medium ${v.variance > 0 ? 'text-red-600 dark:text-red-400' : v.variance < 0 ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'}`}>
                            {v.variance > 0 ? '+' : ''}{v.variance} {v.unit}
                            {v.variancePct != null && (
                              <span className="block text-xs font-normal text-slate-400">{v.variancePct > 0 ? '+' : ''}{v.variancePct}%</span>
                            )}
                          </td>
                          <td className={`px-4 py-3 text-right ${v.varianceCost >= 0 ? 'text-red-600 dark:text-red-400' : 'text-sky-600 dark:text-sky-400'}`}>
                            {v.varianceCost > 0 ? '+' : ''}{formatCurrency(v.varianceCost)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 py-3 border-t border-slate-200 dark:border-slate-700 text-xs text-slate-400 flex flex-wrap gap-x-6 gap-y-1">
                  <span>Shrinkage cost (over-consumption): <span className="text-red-600 dark:text-red-400 font-medium">{formatCurrency(variance.totals.shrinkageCost)}</span></span>
                  <span>Positive = used more than recipes predict (shrinkage/over-portioning); negative = less.</span>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
