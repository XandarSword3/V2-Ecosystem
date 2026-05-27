'use client';

/**
 * Platform Admin — Tenant Drill-Down
 * Shows per-tenant details: properties, modules, billing history, last activity.
 */

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { ArrowLeft, Building2, Package, Clock, CreditCard } from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type BillingStatus = 'trialing' | 'active' | 'past_due' | 'suspended' | 'cancelled';
type SubscriptionTier = 'starter' | 'growth' | 'enterprise';

interface Property {
  id: string;
  name: string;
  slug: string;
  module_count: number;
  is_active: boolean;
}

interface BillingEvent {
  id: string;
  event_type: string;
  amount: number;
  currency: string;
  status: string;
  created_at: string;
}

interface TenantDetail {
  id: string;
  subdomain: string;
  subscription_tier: SubscriptionTier;
  billing_status: BillingStatus;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  feature_limits: Record<string, unknown>;
  trial_ends_at: string | null;
  created_at: string;
  mrr: number;
  properties: Property[];
  billing_history: BillingEvent[];
}

const STATUS_COLOR: Record<BillingStatus, string> = {
  trialing: '#F5A623', active: '#52C41A', past_due: '#FF8C42',
  suspended: '#FF4D4F', cancelled: '#8A95A5',
};

const TIER_COLOR: Record<SubscriptionTier, string> = {
  starter: '#5B8DEF', growth: '#9B5DE5', enterprise: '#F5A623',
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TenantDetailPage() {
  const router = useRouter();
  const params = useParams();
  const tenantId = params?.id as string;

  const [tenant, setTenant] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchTenant = useCallback(async () => {
    try {
      const res = await api.get(`/platform/tenants/${tenantId}`);
      if (res.data?.data) setTenant(res.data.data);
    } catch (err) {
      console.error('[TenantDetail] fetch error', err);
    } finally {
      setLoading(false);
    }
  }, [tenantId]);

  useEffect(() => { fetchTenant(); }, [fetchTenant]);

  if (loading) {
    return (
      <div style={{ background: '#0B0F14', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#5B6B7F', fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif' }}>
        Loading tenant…
      </div>
    );
  }

  if (!tenant) {
    return (
      <div style={{ background: '#0B0F14', minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#FF4D4F', fontSize: 13, fontFamily: 'Inter, system-ui, sans-serif' }}>
        Tenant not found.
      </div>
    );
  }

  return (
    <div style={{ background: '#0B0F14', minHeight: '100vh', padding: 28, fontFamily: 'Inter, system-ui, sans-serif', color: '#E8ECF1' }}>
      {/* Back */}
      <button onClick={() => router.back()}
        style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#5B6B7F', background: 'none', border: 'none', cursor: 'pointer', marginBottom: 24 }}>
        <ArrowLeft size={14} /> Back to tenants
      </button>

      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>{tenant.subdomain}</h1>
        <div style={{ display: 'flex', gap: 12, marginTop: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 12, color: TIER_COLOR[tenant.subscription_tier], fontWeight: 600, textTransform: 'capitalize' }}>
            {tenant.subscription_tier}
          </span>
          <span style={{ fontSize: 10, padding: '2px 8px', background: `${STATUS_COLOR[tenant.billing_status]}20`, color: STATUS_COLOR[tenant.billing_status], border: `1px solid ${STATUS_COLOR[tenant.billing_status]}40`, borderRadius: 4 }}>
            {tenant.billing_status.replace('_', ' ')}
          </span>
          <span style={{ fontSize: 11, color: '#5B6B7F' }}>MRR: {formatCurrency(tenant.mrr)}</span>
          {tenant.trial_ends_at && (
            <span style={{ fontSize: 11, color: '#F5A623' }}>
              Trial ends {new Date(tenant.trial_ends_at).toLocaleDateString()}
            </span>
          )}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {/* Properties */}
        <div style={{ background: '#0B0F14', border: '1px solid #1A222C' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #1A222C', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Building2 size={14} style={{ color: '#3A8DFF' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Properties ({tenant.properties.length})</span>
          </div>
          {tenant.properties.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#5B6B7F', fontSize: 12 }}>No properties yet.</div>
          ) : tenant.properties.map(p => (
            <div key={p.id} style={{ padding: '12px 18px', borderBottom: '1px solid #1A222C', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 13, color: '#E8ECF1', fontWeight: 500 }}>{p.name}</span>
                <div style={{ fontSize: 10, color: '#5B6B7F', marginTop: 2 }}>/{p.slug}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 11, color: '#8A95A5' }}>{p.module_count} modules</span>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: p.is_active ? '#52C41A' : '#5B6B7F' }} />
              </div>
            </div>
          ))}
        </div>

        {/* Feature limits */}
        <div style={{ background: '#0B0F14', border: '1px solid #1A222C' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #1A222C', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Package size={14} style={{ color: '#9B5DE5' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Feature Limits</span>
          </div>
          {Object.entries(tenant.feature_limits).length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#5B6B7F', fontSize: 12 }}>Default limits apply.</div>
          ) : Object.entries(tenant.feature_limits).map(([key, val]) => (
            <div key={key} style={{ padding: '10px 18px', borderBottom: '1px solid #1A222C', display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#8A95A5', textTransform: 'capitalize' }}>{key.replace(/_/g, ' ')}</span>
              <span style={{ fontSize: 12, color: '#E8ECF1', fontVariantNumeric: 'tabular-nums' }}>{String(val)}</span>
            </div>
          ))}
        </div>

        {/* Stripe info */}
        <div style={{ background: '#0B0F14', border: '1px solid #1A222C' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #1A222C', display: 'flex', alignItems: 'center', gap: 8 }}>
            <CreditCard size={14} style={{ color: '#F5A623' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Stripe</span>
          </div>
          <div style={{ padding: '12px 18px' }}>
            {[
              ['Customer ID', tenant.stripe_customer_id],
              ['Subscription ID', tenant.stripe_subscription_id],
              ['Created', new Date(tenant.created_at).toLocaleString()],
            ].map(([label, val]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid #1A222C' }}>
                <span style={{ fontSize: 11, color: '#5B6B7F' }}>{label}</span>
                <span style={{ fontSize: 11, color: '#8A95A5', fontFamily: 'monospace' }}>{val ?? '—'}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Billing history */}
        <div style={{ background: '#0B0F14', border: '1px solid #1A222C' }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid #1A222C', display: 'flex', alignItems: 'center', gap: 8 }}>
            <Clock size={14} style={{ color: '#2EC4B6' }} />
            <span style={{ fontSize: 13, fontWeight: 600 }}>Billing History</span>
          </div>
          {!tenant.billing_history || tenant.billing_history.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#5B6B7F', fontSize: 12 }}>No billing events yet.</div>
          ) : tenant.billing_history.slice(0, 8).map(evt => (
            <div key={evt.id} style={{ padding: '10px 18px', borderBottom: '1px solid #1A222C', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: 12, color: '#E8ECF1' }}>{evt.event_type.replace(/_/g, ' ')}</span>
                <div style={{ fontSize: 10, color: '#5B6B7F', marginTop: 2 }}>{new Date(evt.created_at).toLocaleDateString()}</div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 12, fontVariantNumeric: 'tabular-nums', color: '#E8ECF1' }}>
                  {formatCurrency(evt.amount)} {evt.currency}
                </span>
                <span style={{ fontSize: 10, color: evt.status === 'paid' ? '#52C41A' : '#FF4D4F' }}>
                  {evt.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
