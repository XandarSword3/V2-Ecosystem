'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { BadgeCheck, Users } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';

export interface MembershipDashboardProps {
  slug: string;
  moduleName: string;
  moduleId: string;
}

export function MembershipDashboard({ slug, moduleName, moduleId }: MembershipDashboardProps) {
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [memberships, setMemberships] = useState<any[]>([]);
  const [expiring, setExpiring] = useState<any[]>([]);

  async function loadData() {
    setLoading(true);
    try {
      const [listResponse, expiringResponse] = await Promise.all([
        api.get(`/${slug}/staff/list`),
        api.get(`/${slug}/staff/expiring`),
      ]);
      setMemberships(listResponse.data?.data || []);
      setExpiring(expiringResponse.data?.data || []);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const filteredMemberships = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return memberships;
    return memberships.filter((membership) => {
      const firstName = membership.users?.first_name || '';
      const lastName = membership.users?.last_name || '';
      const email = membership.users?.email || '';
      return `${firstName} ${lastName}`.toLowerCase().includes(query) || email.toLowerCase().includes(query);
    });
  }, [memberships, search]);

  async function runAction(id: string, action: 'activate' | 'extend' | 'suspend') {
    if (action === 'extend') {
      await api.patch(`/${slug}/staff/${id}/extend`, { days: 7 });
    } else {
      await api.patch(`/${slug}/staff/${id}/${action}`);
    }
    await loadData();
  }

  const activeCount = memberships.filter((m) => m.status === 'ACTIVE').length;
  const expiredCount = memberships.filter((m) => m.status === 'EXPIRED').length;
  const expiringCount = expiring.length;

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className="space-y-1">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-slate-100 flex items-center gap-3">
            <BadgeCheck className="h-8 w-8 text-emerald-600" />
            {moduleName} Memberships
          </h1>
          <p className="text-slate-600 dark:text-slate-400">
            Ongoing entitlement dashboard for staff operations.
          </p>
        </header>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-primary" />
                Module Context
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
              <p>
                <span className="font-semibold">Slug:</span> {slug}
              </p>
              <p>
                <span className="font-semibold">Module ID:</span> {moduleId}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Operational Note</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-slate-700 dark:text-slate-300">
              Membership actions are available through the staff API routes wired for this module.
            </CardContent>
          </Card>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader><CardTitle>Total Active</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{activeCount}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Expiring This Week</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{expiringCount}</CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Expired</CardTitle></CardHeader>
            <CardContent className="text-2xl font-semibold">{expiredCount}</CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Active Memberships</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search by customer name/email"
            />
            {loading ? (
              <p className="text-sm text-slate-500">Loading memberships...</p>
            ) : (
              <div className="space-y-3">
                {filteredMemberships.map((membership) => (
                  <div key={membership.id} className="border rounded-lg p-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="font-medium">
                        {membership.users?.first_name} {membership.users?.last_name}
                      </p>
                      <p className="text-sm text-slate-600">{membership.users?.email}</p>
                      <p className="text-xs text-slate-500">Status: {membership.status}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button size="sm" onClick={() => runAction(membership.id, 'activate')}>Activate</Button>
                      <Button size="sm" variant="outline" onClick={() => runAction(membership.id, 'extend')}>Extend +7d</Button>
                      <Button size="sm" variant="ghost" onClick={() => runAction(membership.id, 'suspend')}>Suspend</Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Expiring Soon</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {expiring.map((membership) => (
                <div key={membership.id} className="border rounded-md p-3">
                  <p className="font-medium">
                    {membership.users?.first_name} {membership.users?.last_name}
                  </p>
                  <p className="text-sm text-slate-600">{membership.users?.email}</p>
                  <p className="text-xs text-slate-500">Ends: {new Date(membership.end_date).toLocaleDateString()}</p>
                </div>
              ))}
              {!expiring.length && <p className="text-sm text-slate-500">No memberships expiring in next 7 days.</p>}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
