'use client';

import { useEffect, useState, useCallback } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Building2, Users, Calendar, DollarSign, ExternalLink } from 'lucide-react';
import Link from 'next/link';

interface Tenant {
  id: string;
  subdomain: string;
  name?: string;
  billing_status: string;
  subscription_tier: string;
  created_at: string;
  updated_at?: string;
  mrr?: number;
  email?: string | null;
}

export default function TenantsPage() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTenants = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.get('/platform/tenants');
      const rawList = res.data.data ?? [];
      setTenants(
        rawList.map((t: any) => ({
          id: t.id,
          subdomain: t.subdomain || t.slug || 'unknown',
          name: t.name || t.subdomain || 'Tenant',
          billing_status: t.billing_status || 'trialing',
          subscription_tier: t.subscription_tier || 'starter',
          created_at: t.created_at || new Date().toISOString(),
          mrr: t.mrr,
          email: t.email,
        }))
      );
    } catch (err: any) {
      setError(
        err?.response?.status === 403
          ? 'Platform administrator access is required to manage SaaS tenants.'
          : err?.response?.data?.error ?? 'Failed to load tenants'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTenants();
  }, [fetchTenants]);

  const getBillingStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'trialing':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'past_due':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      case 'suspended':
      case 'cancelled':
        return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Tenants (Engine E)</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage all platform tenants, SaaS subscriptions, and billing status
          </p>
        </div>
        <Link href="/platform-admin">
          <Button variant="outline" size="sm" className="gap-2">
            <ExternalLink className="h-4 w-4" />
            Platform Control Plane
          </Button>
        </Link>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-xl border bg-card h-40 animate-pulse" />
          ))}
        </div>
      ) : tenants.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed py-20 text-center">
          <Building2 className="h-10 w-10 text-muted-foreground mb-3 opacity-40" />
          <p className="font-medium text-muted-foreground">No tenants provisioned yet</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {tenants.map((tenant) => (
            <div
              key={tenant.id}
              className="rounded-xl border bg-card flex flex-col overflow-hidden transition-shadow hover:shadow-md"
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-base font-semibold">{tenant.name}</CardTitle>
                <Badge className={getBillingStatusColor(tenant.billing_status)}>
                  {tenant.billing_status}
                </Badge>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3">
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      Tier
                    </p>
                    <p className="font-semibold uppercase text-xs">{tenant.subscription_tier}</p>
                  </div>
                  <div className="rounded-lg bg-muted/50 px-3 py-2">
                    <p className="text-xs text-muted-foreground mb-0.5 flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5" />
                      Created
                    </p>
                    <p className="font-semibold text-sm truncate">
                      {new Date(tenant.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                {tenant.email && (
                  <p className="text-xs text-muted-foreground mt-2 truncate">
                    Owner: {tenant.email}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1 font-mono">
                  Subdomain: {tenant.subdomain}
                </p>
              </CardContent>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
