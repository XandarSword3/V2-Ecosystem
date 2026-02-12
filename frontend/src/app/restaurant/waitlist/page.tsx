'use client';

import { useState, useEffect, Suspense } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  Users, 
  Clock, 
  CheckCircle, 
  Loader2, 
  Phone, 
  User,
  AlertCircle
} from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import api from '@/lib/api';

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

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

function WaitlistContent() {
  const searchParams = useSearchParams();
  const entryId = searchParams.get('id');
  
  const [view, setView] = useState<'join' | 'status'>(entryId ? 'status' : 'join');
  const [form, setForm] = useState({
    name: '',
    phone: '',
    partySize: 2
  });
  const [submittedEntry, setSubmittedEntry] = useState<WaitlistEntry | null>(null);

  // Fetch entry status if ID provided
  const { data: entryStatus, refetch: refetchStatus } = useQuery({
    queryKey: ['waitlist-status', entryId || submittedEntry?.id],
    queryFn: async () => {
      const id = entryId || submittedEntry?.id;
      if (!id) return null;
      const res = await api.get(`/restaurant/waitlist/${id}`);
      return res.data;
    },
    enabled: !!(entryId || submittedEntry?.id),
    refetchInterval: 30000 // Poll every 30 seconds
  });

  // Join waitlist mutation
  const joinMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string; partySize: number }) => {
      const res = await api.post('/restaurant/waitlist', {
        guest_name: data.name,
        phone: data.phone,
        party_size: data.partySize
      });
      return res.data;
    },
    onSuccess: (data) => {
      setSubmittedEntry(data.data);
      setView('status');
      toast.success('Added to waitlist!');
    },
    onError: () => {
      toast.error('Failed to join waitlist. Please try again.');
    }
  });

  // Leave waitlist mutation
  const leaveMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/restaurant/waitlist/${id}`);
      return res.data;
    },
    onSuccess: () => {
      setSubmittedEntry(null);
      setView('join');
      toast.success('Removed from waitlist');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (form.name && form.phone && form.partySize > 0) {
      joinMutation.mutate(form);
    }
  };

  const currentEntry = entryStatus?.data || submittedEntry;
  const isNotified = currentEntry?.status === 'notified';
  const isSeated = currentEntry?.status === 'seated';
  const isCancelled = currentEntry?.status === 'cancelled' || currentEntry?.status === 'no_show';

  // Join Form View
  if (view === 'join') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-primary/10 to-slate-50 dark:from-primary/5 dark:to-slate-900 flex items-center justify-center p-4">
        <div className="max-w-md w-full">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Users className="w-8 h-8 text-primary" />
            </div>
            <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Join the Waitlist</h1>
            <p className="text-slate-600 dark:text-slate-400 mt-2">
              No reservation? No problem! Join our waitlist.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700 space-y-5">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <User className="w-4 h-4" />
                Your Name
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="John Smith"
                required
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Phone className="w-4 h-4" />
                Phone Number
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 (555) 000-0000"
                required
                className="w-full px-4 py-3 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white focus:ring-2 focus:ring-primary focus:border-transparent"
              />
              <p className="text-xs text-slate-500 mt-1">We'll text you when your table is ready</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                <Users className="w-4 h-4" />
                Party Size
              </label>
              <div className="flex gap-2 flex-wrap">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
                  <button
                    key={size}
                    type="button"
                    onClick={() => setForm({ ...form, partySize: size })}
                    className={`w-12 h-12 rounded-xl font-semibold transition-colors ${
                      form.partySize === size
                        ? 'bg-primary text-white'
                        : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-600'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>

            <button
              type="submit"
              disabled={joinMutation.isPending || !form.name || !form.phone}
              className="w-full py-4 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            >
              {joinMutation.isPending ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Joining...
                </>
              ) : (
                <>
                  <Users className="w-5 h-5" />
                  Join Waitlist
                </>
              )}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-4">
            Already on the list?{' '}
            <button 
              onClick={() => {
                const id = prompt('Enter your waitlist ID:');
                if (id) window.location.href = `?id=${id}`;
              }}
              className="text-primary hover:underline"
            >
              Check your status
            </button>
          </p>
        </div>
      </div>
    );
  }

  // Status View
  return (
    <div className="min-h-screen bg-gradient-to-b from-primary/10 to-slate-50 dark:from-primary/5 dark:to-slate-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full">
        {/* Notified Alert */}
        {isNotified && (
          <div className="mb-6 bg-green-100 dark:bg-green-900/30 border-2 border-green-500 rounded-2xl p-6 text-center animate-pulse">
            <CheckCircle className="w-12 h-12 mx-auto text-green-600 dark:text-green-400 mb-3" />
            <h2 className="text-xl font-bold text-green-800 dark:text-green-200">Your Table is Ready!</h2>
            <p className="text-green-700 dark:text-green-300 mt-1">
              Please proceed to the host stand
            </p>
          </div>
        )}

        <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-200 dark:border-slate-700">
          {isCancelled ? (
            <div className="text-center py-8">
              <AlertCircle className="w-16 h-16 mx-auto text-slate-400 mb-4" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                No Longer on Waitlist
              </h2>
              <p className="text-slate-600 dark:text-slate-400 mb-6">
                Your waitlist entry has been removed.
              </p>
              <button
                onClick={() => setView('join')}
                className="px-6 py-3 bg-primary text-white rounded-xl hover:bg-primary/90"
              >
                Join Again
              </button>
            </div>
          ) : isSeated ? (
            <div className="text-center py-8">
              <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-4" />
              <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-2">
                You've Been Seated!
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                Enjoy your meal!
              </p>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  {currentEntry?.guest_name || 'Guest'}
                </h2>
                <p className="text-slate-600 dark:text-slate-400">
                  Party of {currentEntry?.party_size || form.partySize}
                </p>
              </div>

              {/* Position Display */}
              <div className="bg-primary/5 rounded-2xl p-8 text-center mb-6">
                <p className="text-sm uppercase tracking-wide text-primary font-semibold mb-2">
                  Your Position
                </p>
                <div className="text-6xl font-bold text-primary mb-2">
                  #{currentEntry?.position || '?'}
                </div>
                <p className="text-slate-600 dark:text-slate-400">
                  in line
                </p>
              </div>

              {/* Estimated Wait */}
              <div className="flex items-center justify-center gap-2 text-slate-600 dark:text-slate-400 mb-6">
                <Clock className="w-5 h-5" />
                <span>
                  Estimated wait: <strong className="text-slate-900 dark:text-white">
                    {currentEntry?.estimated_wait || 15}-{(currentEntry?.estimated_wait || 15) + 10} minutes
                  </strong>
                </span>
              </div>

              {/* Info Box */}
              <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 mb-6">
                <p className="text-sm text-blue-800 dark:text-blue-200">
                  <strong>Tip:</strong> We'll send you a text when your table is ready. 
                  Feel free to explore the resort - just stay within 5 minutes of the restaurant.
                </p>
              </div>

              {/* Leave Button */}
              <button
                onClick={() => {
                  if (confirm('Are you sure you want to leave the waitlist?')) {
                    leaveMutation.mutate(currentEntry?.id);
                  }
                }}
                disabled={leaveMutation.isPending}
                className="w-full py-3 border border-red-300 dark:border-red-800 text-red-600 dark:text-red-400 rounded-xl hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors"
              >
                {leaveMutation.isPending ? 'Leaving...' : 'Leave Waitlist'}
              </button>
            </>
          )}
        </div>

        {/* Auto-refresh notice */}
        {!isCancelled && !isSeated && (
          <p className="text-center text-xs text-slate-500 mt-4">
            This page updates automatically every 30 seconds
          </p>
        )}
      </div>
    </div>
  );
}

export default function WaitlistPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 flex items-center justify-center">
        <Loader2 className="w-12 h-12 animate-spin text-amber-500" />
      </div>
    }>
      <WaitlistContent />
    </Suspense>
  );
}
