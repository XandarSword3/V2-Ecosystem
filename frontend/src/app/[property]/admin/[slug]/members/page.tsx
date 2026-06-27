'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { api } from '@/lib/api';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Users, RefreshCw, Search, Calendar, Award } from 'lucide-react';
import { Input } from '@/components/ui/Input';
import { toast } from 'sonner';
import { format } from 'date-fns';

type MemberStatus = 'pending' | 'active' | 'paused' | 'expired' | 'cancelled';

interface Member {
  id: string;
  customer_id: string;
  plan_id: string;
  status: MemberStatus;
  amount: number;
  starts_at: string;
  ends_at?: string;
  created_at: string;
  // joined via query
  customer_name?: string;
  customer_email?: string;
  plan_name?: string;
}

const STATUS_STYLES: Record<MemberStatus, string> = {
  active:    'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400',
  pending:   'bg-amber-100   text-amber-700   dark:bg-amber-900/30   dark:text-amber-400',
  paused:    'bg-blue-100    text-blue-700    dark:bg-blue-900/30    dark:text-blue-400',
  expired:   'bg-slate-100   text-slate-500   dark:bg-slate-700      dark:text-slate-400',
  cancelled: 'bg-red-100     text-red-600     dark:bg-red-900/30     dark:text-red-400',
};

const ALL_STATUSES: MemberStatus[] = ['active', 'pending', 'paused', 'expired', 'cancelled'];

export default function MembersAdminPage() {
  const params = useParams();
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;

  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<MemberStatus | 'all'>('all');

  const fetchMembers = async () => {
    try {
      setLoading(true);
      const res = await api.get(`/${slug}/subscriptions`);
      setMembers(res.data.data || []);
    } catch (err) {
      toast.error('Failed to load members');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMembers();
  }, [slug]);

  const filtered = members.filter(m => {
    const matchesStatus = statusFilter === 'all' || m.status === statusFilter;
    const query = search.toLowerCase();
    const matchesSearch =
      !query ||
      (m.customer_name || '').toLowerCase().includes(query) ||
      (m.customer_email || '').toLowerCase().includes(query) ||
      (m.plan_name || '').toLowerCase().includes(query);
    return matchesStatus && matchesSearch;
  });

  const counts = members.reduce((acc, m) => {
    acc[m.status] = (acc[m.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-lg">
              <Users className="w-6 h-6 text-white" />
            </div>
            Members
          </h1>
          <p className="text-slate-600 dark:text-slate-400 mt-1">
            Active subscriptions for this module
          </p>
        </div>
        <Button variant="outline" onClick={fetchMembers}>
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {ALL_STATUSES.map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(statusFilter === s ? 'all' : s)}
            className={`rounded-xl p-3 border text-left transition-colors ${
              statusFilter === s
                ? 'border-violet-500 bg-violet-50 dark:bg-violet-900/20'
                : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-slate-300'
            }`}
          >
            <p className="text-xs text-slate-500 dark:text-slate-400 capitalize">{s}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{counts[s] || 0}</p>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input
          placeholder="Search by name, email or plan..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="h-16 bg-slate-100 dark:bg-slate-800 animate-pulse rounded-xl" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-500 dark:text-slate-400 font-medium">No members found</p>
            <p className="text-sm text-slate-400 mt-1">
              {members.length === 0
                ? 'No one has subscribed to this module yet.'
                : 'Try adjusting your search or filter.'}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 dark:bg-slate-800/60 text-slate-500 dark:text-slate-400">
              <tr>
                <th className="text-left px-4 py-3 font-medium">Member</th>
                <th className="text-left px-4 py-3 font-medium">Plan</th>
                <th className="text-left px-4 py-3 font-medium">Status</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Started</th>
                <th className="text-left px-4 py-3 font-medium hidden md:table-cell">Expires</th>
                <th className="text-right px-4 py-3 font-medium">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50 bg-white dark:bg-slate-800">
              {filtered.map(m => (
                <tr key={m.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900 dark:text-white">
                      {m.customer_name || '—'}
                    </p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {m.customer_email || m.customer_id.slice(0, 8) + '…'}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                      <Award className="w-3.5 h-3.5 text-slate-400" />
                      {m.plan_name || '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 text-xs rounded-full font-medium capitalize ${STATUS_STYLES[m.status]}`}>
                      {m.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-500 dark:text-slate-400">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5" />
                      {m.starts_at ? format(new Date(m.starts_at), 'MMM d, yyyy') : '—'}
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell text-slate-500 dark:text-slate-400">
                    {m.ends_at ? format(new Date(m.ends_at), 'MMM d, yyyy') : 'Ongoing'}
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 dark:text-white">
                    ${m.amount}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="px-4 py-2 bg-slate-50 dark:bg-slate-800/60 text-xs text-slate-400 border-t border-slate-100 dark:border-slate-700">
            {filtered.length} of {members.length} member{members.length !== 1 ? 's' : ''}
          </div>
        </div>
      )}
    </div>
  );
}
