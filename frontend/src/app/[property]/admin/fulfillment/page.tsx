'use client';

/**
 * F11 — Unified Fulfillment work queue.
 *
 * One cross-engine operational surface consuming the canonical fulfillments
 * table via /admin/fulfillment/queue. Every action button rendered here comes
 * from the engine-computed `availableActions` list — this page NEVER
 * hardcodes a vertical state name (plan rule 2). The mode tells staff WHAT
 * the work is; the actions tell them what they CAN do.
 */

import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import { RefreshCw, Wrench, ArrowRight, MapPin } from 'lucide-react';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { CardSkeleton } from '@/components/ui/Skeleton';

interface QueueAction {
  action: string;
  targetState: string;
}

interface WorkItem {
  id: string;
  transactionId: string;
  engineType: string;
  module: { slug: string; name: string } | null;
  fulfillmentStatus: string;
  fulfillmentMode: string | null;
  transactionStatus: string | null;
  availableActions: QueueAction[];
  destinationType: string | null;
  destinationRef: string | null;
  trackingRef: string | null;
  reference: string;
  customerName: string;
  amount: number | string;
  currency: string;
  queuedAt: string | null;
  createdAt: string;
}

interface QueueResponse {
  items: WorkItem[];
  modules: Array<{ slug: string; name: string; engineType: string }>;
}

/** Humanize an action key: start_preparation → Start preparation. */
function humanizeAction(action: string): string {
  return action
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function AdminFulfillmentPage() {
  const t = useTranslations('admin');
  const queryClient = useQueryClient();

  const [moduleFilter, setModuleFilter] = useState('all');

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['admin-fulfillment-queue', moduleFilter],
    queryFn: async (): Promise<QueueResponse> => {
      const apiParams: Record<string, string | number> = { limit: 200 };
      if (moduleFilter !== 'all') apiParams.module = moduleFilter;
      const res = await api.get('/admin/fulfillment/queue', { params: apiParams });
      return res.data.data;
    },
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  // Fulfillment action: route through the order status endpoint (works for
  // instant_transaction orders; other engine types surface their states and
  // use their module-specific workflows — the queue makes cross-engine work
  // VISIBLE even where the action path is engine-specific).
  const actionMutation = useMutation({
    mutationFn: async ({ item, action }: { item: WorkItem; action: string }) => {
      if (item.engineType === 'instant_transaction') {
        await api.post(`/admin/staff/modules/${item.module?.slug}/orders/${item.transactionId}/status`, {
          status: action,
        });
        return;
      }
      // Non-instant engines: no generic action endpoint exists yet — surface
      // the state and direct staff to the module workspace.
      throw new Error('This engine requires its module workspace for transitions');
    },
    onSuccess: () => {
      toast.success('Work item updated');
      queryClient.invalidateQueries({ queryKey: ['admin-fulfillment-queue'] });
    },
    onError: (err: Error) => {
      toast.error(err.message || 'Action failed');
    },
  });

  const items = useMemo(() => data?.items ?? [], [data]);
  const modules = useMemo(() => data?.modules ?? [], [data]);

  // Group by module for a scannable operational board.
  const byModule = useMemo(() => {
    const groups = new Map<string, WorkItem[]>();
    for (const item of items) {
      const key = item.module?.slug ?? 'unknown';
      const list = groups.get(key) ?? (groups.set(key, []), groups.get(key)!);
      list.push(item);
    }
    return Array.from(groups.entries());
  }, [items]);

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Wrench className="w-6 h-6" />
            {t('nav.fulfillment')}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Live work queue across all engines — canonical fulfillment states
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={moduleFilter}
            onChange={(e) => setModuleFilter(e.target.value)}
            className="px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-sm"
            aria-label="Filter by module"
          >
            <option value="all">All modules</option>
            {modules.map((m) => (
              <option key={m.slug} value={m.slug}>{m.name}</option>
            ))}
          </select>
          <button
            onClick={() => refetch()}
            disabled={isFetching}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <CardSkeleton />
      ) : isError ? (
        <div className="p-8 text-center text-slate-500 dark:text-slate-400">
          Failed to load the work queue
        </div>
      ) : items.length === 0 ? (
        <div className="p-12 text-center border border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <Wrench className="w-10 h-10 mx-auto text-slate-300 dark:text-slate-600 mb-3" />
          <p className="text-sm text-slate-500 dark:text-slate-400">
            No active fulfillment work — all clear
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {byModule.map(([slug, moduleItems]) => (
            <div key={slug}>
              <h2 className="text-sm font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">
                {moduleItems[0]?.module?.name ?? slug} ({moduleItems.length})
              </h2>
              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {moduleItems.map((item) => (
                  <div
                    key={item.id}
                    className="p-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium text-slate-900 dark:text-white truncate">
                          {item.reference}
                        </p>
                        <p className="text-xs text-slate-500 dark:text-slate-400">
                          {item.customerName} · {formatCurrency(item.amount, item.currency)}
                        </p>
                      </div>
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 whitespace-nowrap">
                        {item.fulfillmentStatus}
                      </span>
                    </div>

                    {item.destinationRef && (
                      <p className="mt-2 text-xs text-slate-500 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {item.destinationRef}
                      </p>
                    )}

                    <div className="mt-3 flex flex-wrap gap-2">
                      {item.availableActions.length === 0 ? (
                        <p className="text-xs text-slate-400">Awaiting upstream state…</p>
                      ) : (
                        item.availableActions.map(({ action, targetState }) => (
                          <button
                            key={action}
                            disabled={actionMutation.isPending}
                            onClick={() => actionMutation.mutate({ item, action })}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-900 text-white dark:bg-white dark:text-slate-900 hover:opacity-90 disabled:opacity-50"
                          >
                            {humanizeAction(action)}
                            <ArrowRight className="w-3 h-3" />
                            {targetState}
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
