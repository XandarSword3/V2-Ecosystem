'use client';

import { useState, useCallback, Suspense } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Users, Clock, CheckCircle, Loader2, Phone, User, AlertCircle } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { api } from '@/lib/api';
import { useSiteSettings } from '@/lib/settings-context';
import { useWaitlistUpdates } from '@/lib/socket';
import Link from 'next/link';

interface WaitlistEntry {
  id: string;
  guest_name: string;
  party_size: number;
  phone: string;
  status: 'waiting' | 'notified' | 'seated' | 'cancelled' | 'no_show';
  position: number;
  estimated_wait: number;
  created_at: string;
}

function WaitlistContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const rawSlug = params?.slug;
  const slug = Array.isArray(rawSlug) ? rawSlug[0] : rawSlug || '';
  const propertySlug = (params?.property as string) || '';
  const { modules, loading } = useSiteSettings();
  const currentModule = modules.find((m) => m.slug.toLowerCase() === decodeURIComponent(slug).toLowerCase());
  const entryId = searchParams.get('id');

  const [view, setView] = useState<'join' | 'status'>(entryId ? 'status' : 'join');
  const [form, setForm] = useState({ name: '', phone: '', partySize: 2 });
  const [submittedEntry, setSubmittedEntry] = useState<WaitlistEntry | null>(null);

  const { data: entryStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['waitlist-status', entryId || submittedEntry?.id],
    queryFn: async () => {
      const id = entryId || submittedEntry?.id;
      if (!id) return null;
      const res = await api.get(`/${slug}/waitlist/${id}`);
      return res.data;
    },
    enabled: !!(entryId || submittedEntry?.id),
  });

  // Real-time waitlist updates via Socket.IO
  const handleWaitlistUpdate = useCallback((data: any) => {
    const currentId = entryId || submittedEntry?.id;
    if (currentId && (data.entry?.id === currentId || data.entryId === currentId)) {
      refetchStatus();
    }
  }, [entryId, submittedEntry?.id, refetchStatus]);
  useWaitlistUpdates(handleWaitlistUpdate);

  const joinMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string; partySize: number }) => {
      const res = await api.post(`/${slug}/waitlist`, {
        guest_name: data.name,
        phone: data.phone,
        party_size: data.partySize,
        module_id: currentModule?.id,
      });
      return res.data;
    },
    onSuccess: (data) => {
      setSubmittedEntry(data.data);
      setView('status');
      toast.success('Added to waitlist!');
    },
    onError: () => toast.error('Failed to join waitlist. Please try again.'),
  });

  const leaveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/${slug}/waitlist/${id}/leave`);
      return res.data;
    },
    onSuccess: () => {
      setSubmittedEntry(null);
      setView('join');
      toast.success('Removed from waitlist');
    },
    onError: () => toast.error('Failed to leave waitlist'),
  });

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!currentModule) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-xl font-bold mb-2">Module Not Found</h2>
          <Link href={`/${propertySlug}`} className="text-primary hover:underline">Return Home</Link>
        </div>
      </div>
    );
  }

  const moduleName = currentModule.name;
  const activeEntry = entryStatus?.data || submittedEntry;
  const statusColor = {
    waiting: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
    notified: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    seated: 'text-green-600 bg-green-50 dark:bg-green-900/20',
    cancelled: 'text-red-600 bg-red-50 dark:bg-red-900/20',
    no_show: 'text-slate-600 bg-slate-50 dark:bg-slate-900/20',
  };

  // Status View
  if (view === 'status' && activeEntry) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white dark:bg-slate-800 rounded-2xl p-8 text-center border border-slate-200 dark:border-slate-700">
          <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
            <Clock className="w-10 h-10 text-amber-600 dark:text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white mb-2">Waitlist Status</h1>
          <p className="text-slate-600 dark:text-slate-400 mb-6">{moduleName}</p>

          <div className="bg-slate-50 dark:bg-slate-700/50 rounded-xl p-4 mb-6">
            <div className="space-y-3 text-left">
              <div className="flex justify-between">
                <span className="text-slate-500">Name</span>
                <span className="font-medium text-slate-900 dark:text-white">{activeEntry.guest_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Party Size</span>
                <span className="font-medium text-slate-900 dark:text-white">{activeEntry.party_size} guests</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Position</span>
                <span className="font-bold text-2xl text-primary">#{activeEntry.position || '-'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Est. Wait</span>
                <span className="font-medium text-slate-900 dark:text-white">{activeEntry.estimated_wait || '~15'} min</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Status</span>
                <span className={`px-3 py-1 rounded-full text-sm font-medium capitalize ${statusColor[activeEntry.status as keyof typeof statusColor] || 'text-slate-600 bg-slate-100'}`}>
                  {activeEntry.status}
                </span>
              </div>
            </div>
          </div>

          {activeEntry.status === 'waiting' && (
            <button onClick={() => leaveMutation.mutate(activeEntry.id)} disabled={leaveMutation.isPending} className="w-full py-3 border border-red-300 text-red-600 font-semibold rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors mb-3">
              {leaveMutation.isPending ? 'Leaving...' : 'Leave Waitlist'}
            </button>
          )}

          <button onClick={() => refetchStatus()} className="w-full py-3 bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 font-semibold rounded-xl hover:bg-slate-200 dark:hover:bg-slate-600 transition-colors">
            Refresh Status
          </button>
        </div>
      </div>
    );
  }

  // Join View (default)
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900">
      <div className="bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Join the Waitlist</h1>
          <p className="text-slate-600 dark:text-slate-400 mt-2">No reservation? Join the waitlist for {moduleName}</p>
        </div>
      </div>
      <div className="max-w-md mx-auto px-4 py-8">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-6 border border-slate-200 dark:border-slate-700 space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <User className="w-4 h-4" /> Your Name *
            </label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="John Smith" className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              <Phone className="w-4 h-4" /> Phone Number *
            </label>
            <input type="tel" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} placeholder="+1 (555) 000-0000" className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white" />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-4">
              <Users className="w-4 h-4" /> Party Size
            </label>
            <div className="flex gap-2 flex-wrap">
              {[1, 2, 3, 4, 5, 6].map((size) => (
                <button key={size} onClick={() => setForm({ ...form, partySize: size })} className={`px-4 py-2.5 rounded-lg font-medium transition-colors ${form.partySize === size ? 'bg-primary text-white' : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'}`}>
                  {size}
                </button>
              ))}
            </div>
          </div>

          <button onClick={() => joinMutation.mutate({ name: form.name, phone: form.phone, partySize: form.partySize })} disabled={!form.name || !form.phone || joinMutation.isPending} className="w-full py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2">
            {joinMutation.isPending ? <><Loader2 className="w-5 h-5 animate-spin" /> Joining...</> : 'Join Waitlist'}
          </button>
        </div>

        <div className="mt-4 text-center">
          <Link href={`/${propertySlug}/${slug}`} className="text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 text-sm">
            Back to {moduleName}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ModuleWaitlistPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
      <WaitlistContent />
    </Suspense>
  );
}
