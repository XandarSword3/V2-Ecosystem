'use client';

/**
 * Platform Admin — Control Plane
 *
 * Accessible only to users with is_platform_admin = true.
 * Tenant-level auth is bypassed here; all queries use the platform API
 * routes that run with service-role access.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import {
  Building2,
  TrendingUp,
  AlertCircle,
  CheckCircle2,
  Clock,
  Ban,
  RefreshCw,
  ChevronRight,
  Search,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
type SubscriptionTier = 'starter' | 'growth' | 'enterprise';

interface Tenant {
  id: string;
  subdomain: string;
  email: string | null;
  // NOTE: no longer a closed enum on the backend — migration
  // 20260703140000_change_subscription_tier_to_text.sql made this a free-text
  // column driven by the `plans` table, so any plan code a super-admin creates
  // can show up here. Do not assume it's one of SubscriptionTier's 3 values.
  subscription_tier: string;
  billing_status: BillingStatus;
  mrr: number;
  property_count: number;
  module_count: number;
  last_activity: string | null;
  created_at: string;
}

interface RevenuePoint {
  date: string;
  mrr: number;
}

interface PlatformStats {
  total_tenants: number;
  active_tenants: number;
  trialing_tenants: number;
  suspended_tenants: number;
  total_mrr: number;
  mrr_growth_percent: number;
  revenue_history: RevenuePoint[];
}

// ─── Display maps ─────────────────────────────────────────────────────────────

const STATUS_STYLE: Record<BillingStatus, { label: string; color: string; bg: string }> = {
  trialing:  { label: 'Trial',     color: '#F5A623', bg: 'rgba(245,166,35,0.12)'  },
  active:    { label: 'Active',    color: '#52C41A', bg: 'rgba(82,196,26,0.12)'   },
  past_due:  { label: 'Past Due',  color: '#FF8C42', bg: 'rgba(255,140,66,0.12)'  },
  suspended: { label: 'Suspended', color: '#FF4D4F', bg: 'rgba(255,77,79,0.12)'   },
  cancelled: { label: 'Cancelled', color: '#8A95A5', bg: 'rgba(138,149,165,0.12)' },
};

const TIER_STYLE: Record<SubscriptionTier, { label: string; color: string }> = {
  starter:    { label: 'Starter',    color: '#5B8DEF' },
  growth:     { label: 'Growth',     color: '#9B5DE5' },
  enterprise: { label: 'Enterprise', color: '#F5A623' },
};

// subscription_tier is free-text (plan codes from the `plans` table), so any
// value outside the 3 legacy tiers above is expected, not an error. Fall
// back to a neutral style + title-cased label instead of crashing.
const DEFAULT_TIER_STYLE = { color: '#8A95A5' };
function getTierStyle(tier: string): { label: string; color: string } {
  return TIER_STYLE[tier as SubscriptionTier] ?? {
    label: tier ? tier.charAt(0).toUpperCase() + tier.slice(1) : 'Unknown',
    color: DEFAULT_TIER_STYLE.color,
  };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string;
}) {
  return (
    <div style={{
      background: '#0B0F14', border: '1px solid #1A222C',
      borderLeft: `3px solid ${color}`, padding: '18px 22px',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
        <span style={{ fontSize: 11, color: '#5B6B7F', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {title}
        </span>
        <Icon size={16} style={{ color }} />
      </div>
      <div style={{ fontSize: 30, fontWeight: 700, color: '#E8ECF1', marginTop: 10, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      {sub && <div style={{ fontSize: 12, color: '#5B6B7F', marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

function StatusBadge({ status }: { status: BillingStatus }) {
  const s = STATUS_STYLE[status];
  return (
    <span style={{
      fontSize: 11, fontWeight: 500, padding: '3px 10px',
      background: s.bg, color: s.color,
      border: `1px solid ${s.color}40`, borderRadius: 4,
    }}>
      {s.label}
    </span>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function PlatformAdminPage() {
  const router = useRouter();

  const [stats, setStats] = useState<PlatformStats | null>(null);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<BillingStatus | 'all'>('all');
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    try {
      const [statsRes, tenantsRes] = await Promise.all([
        api.get('/platform/stats'),
        api.get('/platform/tenants'),
      ]);
      if (statsRes.data?.data) setStats(statsRes.data.data);
      if (tenantsRes.data?.data) setTenants(tenantsRes.data.data);
      setLastRefresh(new Date());
    } catch (err) {
      console.error('[PlatformAdmin] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const suspend = async (tenantId: string) => {
    if (!confirm('Suspend this tenant? They will receive a 402 on all requests.')) return;
    setActionLoading(tenantId);
    try {
      await api.post(`/platform/tenants/${tenantId}/suspend`);
      await fetchData();
    } finally { setActionLoading(null); }
  };

  const unsuspend = async (tenantId: string) => {
    setActionLoading(tenantId);
    try {
      await api.post(`/platform/tenants/${tenantId}/unsuspend`);
      await fetchData();
    } finally { setActionLoading(null); }
  };

  const changeTier = async (tenantId: string, tier: SubscriptionTier) => {
    setActionLoading(tenantId);
    try {
      await api.patch(`/platform/tenants/${tenantId}/tier`, { tier });
      await fetchData();
    } finally { setActionLoading(null); }
  };

  const filtered = tenants.filter(t => {
    const matchSearch = t.subdomain.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === 'all' || t.billing_status === statusFilter;
    return matchSearch && matchStatus;
  });

  return (
    <div style={{
      background: '#0B0F14', minHeight: '100vh', padding: 28,
      fontFamily: 'Inter, system-ui, sans-serif', color: '#E8ECF1',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 28 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0, letterSpacing: '-0.02em' }}>
            Platform Control Plane
          </h1>
          <p style={{ fontSize: 12, color: '#5B6B7F', marginTop: 4 }}>
            Last updated {lastRefresh.toLocaleTimeString()}
          </p>
        </div>
        <button
          onClick={fetchData}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '8px 14px', background: '#111820',
            border: '1px solid #1A222C', color: '#8A95A5',
            fontSize: 12, cursor: 'pointer',
          }}
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {/* KPI strip */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 1, background: '#1A222C', marginBottom: 28 }}>
        <StatCard title="Total Tenants" icon={Building2} color="#3A8DFF"
          value={loading ? '—' : (stats?.total_tenants ?? 0)}
          sub={loading ? undefined : `${stats?.active_tenants ?? 0} active`}
        />
        <StatCard title="Trialing" icon={Clock} color="#F5A623"
          value={loading ? '—' : (stats?.trialing_tenants ?? 0)}
        />
        <StatCard title="Suspended" icon={AlertCircle} color="#FF4D4F"
          value={loading ? '—' : (stats?.suspended_tenants ?? 0)}
        />
        <StatCard title="Total MRR" icon={TrendingUp} color="#52C41A"
          value={loading ? '—' : formatCurrency(stats?.total_mrr ?? 0)}
          sub={stats?.mrr_growth_percent != null
            ? `${stats.mrr_growth_percent >= 0 ? '↑' : '↓'} ${Math.abs(stats.mrr_growth_percent).toFixed(1)}% vs last month`
            : undefined}
        />
      </div>

      {/* MRR chart */}
      {stats?.revenue_history && stats.revenue_history.length > 0 && (
        <div style={{ background: '#0B0F14', border: '1px solid #1A222C', padding: 20, marginBottom: 28 }}>
          <p style={{ fontSize: 13, fontWeight: 600, marginBottom: 16 }}>MRR History</p>
          <div style={{ height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={stats.revenue_history}>
                <defs>
                  <linearGradient id="mrrGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#52C41A" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#52C41A" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="date" tick={{ fill: '#5B6B7F', fontSize: 10 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: '#5B6B7F', fontSize: 10 }} axisLine={false} tickLine={false}
                  tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)}k`} width={40} />
                <Tooltip contentStyle={{ background: '#111820', border: '1px solid #1A222C', fontSize: 12 }}
                  formatter={(v) => [formatCurrency(Number(v ?? 0)), 'MRR']} />
                <Area type="monotone" dataKey="mrr" stroke="#52C41A" strokeWidth={2}
                  fill="url(#mrrGrad)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* Tenant table */}
      <div style={{ background: '#0B0F14', border: '1px solid #1A222C' }}>
        {/* Filters */}
        <div style={{ padding: '14px 18px', borderBottom: '1px solid #1A222C', display: 'flex', alignItems: 'center', gap: 12 }}>
          <p style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>Tenants ({filtered.length})</p>
          <div style={{ position: 'relative' }}>
            <Search size={12} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', color: '#5B6B7F' }} />
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search subdomain…"
              style={{ background: '#111820', border: '1px solid #1A222C', color: '#E8ECF1', fontSize: 12, padding: '6px 10px 6px 28px', outline: 'none', width: 200 }} />
          </div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as BillingStatus | 'all')}
            style={{ background: '#111820', border: '1px solid #1A222C', color: '#8A95A5', fontSize: 12, padding: '6px 10px', outline: 'none' }}>
            <option value="all">All statuses</option>
            {(Object.keys(STATUS_STYLE) as BillingStatus[]).map(s => (
              <option key={s} value={s} style={{ background: '#111820' }}>{STATUS_STYLE[s].label}</option>
            ))}
          </select>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ background: '#111820' }}>
              {['Subdomain', 'Email', 'Tier', 'Status', 'MRR', 'Properties', 'Created', 'Actions'].map(h => (
                <th key={h} style={{
                  padding: '10px 16px', textAlign: 'left', fontSize: 10,
                  color: '#5B6B7F', fontWeight: 500, textTransform: 'uppercase',
                  letterSpacing: 0.5, borderBottom: '1px solid #1A222C',
                }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#5B6B7F', fontSize: 13 }}>Loading…</td></tr>
            ) : filtered.length === 0 ? (
              <tr><td colSpan={8} style={{ padding: 40, textAlign: 'center', color: '#5B6B7F', fontSize: 13 }}>No tenants match your filters.</td></tr>
            ) : filtered.map((tenant, i) => {
              const isBusy = actionLoading === tenant.id;
              return (
                <tr key={tenant.id} style={{ background: i % 2 === 0 ? '#0B0F14' : '#0d1117' }}>
                  {/* Subdomain */}
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #1A222C' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, color: '#E8ECF1' }}>{tenant.subdomain}</span>
                    {tenant.last_activity && (
                      <div style={{ fontSize: 10, color: '#5B6B7F', marginTop: 2 }}>
                        Active {new Date(tenant.last_activity).toLocaleDateString()}
                      </div>
                    )}
                  </td>

                  {/* Email */}
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #1A222C', fontSize: 12, color: '#8A95A5' }}>
                    {tenant.email ?? '—'}
                  </td>

                  {/* Tier — inline select for quick upgrade/downgrade */}
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #1A222C' }}>
                    <select
                      value={tenant.subscription_tier}
                      onChange={e => changeTier(tenant.id, e.target.value as SubscriptionTier)}
                      disabled={isBusy}
                      style={{
                        background: 'transparent', border: 'none',
                        color: getTierStyle(tenant.subscription_tier).color,
                        fontSize: 12, fontWeight: 600, cursor: 'pointer', outline: 'none',
                      }}
                    >
                      {/* Union of the 3 known tiers + this tenant's actual tier,
                          in case it's a custom plan code not in TIER_STYLE — an
                          unlisted current value would otherwise not render as
                          an option and the <select> would show blank. */}
                      {Array.from(new Set([
                        ...(Object.keys(TIER_STYLE) as SubscriptionTier[]),
                        tenant.subscription_tier,
                      ])).map(t => (
                        <option key={t} value={t} style={{ background: '#111820', color: '#E8ECF1' }}>
                          {getTierStyle(t).label}
                        </option>
                      ))}
                    </select>
                  </td>

                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #1A222C' }}>
                    <StatusBadge status={tenant.billing_status} />
                  </td>

                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #1A222C', fontSize: 13, fontVariantNumeric: 'tabular-nums' }}>
                    {formatCurrency(tenant.mrr)}
                  </td>

                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #1A222C', fontSize: 12, color: '#8A95A5' }}>
                    {tenant.property_count} props · {tenant.module_count} modules
                  </td>

                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #1A222C', fontSize: 12, color: '#5B6B7F' }}>
                    {new Date(tenant.created_at).toLocaleDateString()}
                  </td>

                  {/* Actions */}
                  <td style={{ padding: '12px 16px', borderBottom: '1px solid #1A222C' }}>
                    <div style={{ display: 'flex', gap: 8 }}>
                      {tenant.billing_status === 'suspended' ? (
                        <button onClick={() => unsuspend(tenant.id)} disabled={isBusy}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', background: 'rgba(82,196,26,0.1)', color: '#52C41A', border: '1px solid rgba(82,196,26,0.3)', cursor: 'pointer', opacity: isBusy ? 0.5 : 1 }}>
                          <CheckCircle2 size={11} /> Restore
                        </button>
                      ) : (
                        <button onClick={() => suspend(tenant.id)} disabled={isBusy || tenant.billing_status === 'cancelled'}
                          style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', background: 'rgba(255,77,79,0.08)', color: '#FF8A8A', border: '1px solid rgba(255,77,79,0.3)', cursor: 'pointer', opacity: (isBusy || tenant.billing_status === 'cancelled') ? 0.4 : 1 }}>
                          <Ban size={11} /> Suspend
                        </button>
                      )}
                      <button onClick={() => router.push(`/platform-admin/tenants/${tenant.id}`)}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, padding: '4px 10px', background: '#111820', color: '#8A95A5', border: '1px solid #1A222C', cursor: 'pointer' }}>
                        View <ChevronRight size={11} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
