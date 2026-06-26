'use client';

import { useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSiteSettings } from '@/lib/settings-context';
import { api } from '@/lib/api';
import { useWaitlistUpdates } from '@/lib/socket';
import {
  Users,
  Clock,
  Search,
  Phone,
  Bell,
  UserCheck,
  UserX,
  Plus,
  Loader2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import { toast } from 'sonner';

interface WaitlistEntry {
  id: string;
  guest_name: string;
  party_size: number;
  phone: string;
  status: 'waiting' | 'notified' | 'seated' | 'cancelled' | 'no_show';
  position: number;
  estimated_wait: number;
  notes?: string;
  created_at: string;
  notified_at?: string;
}

const statusColors: Record<string, string> = {
  waiting: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
  notified: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
  seated: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  cancelled: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
  no_show: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
};

export default function DynamicWaitlistPage() {
  const params = useParams();
  const { modules } = useSiteSettings();
  const queryClient = useQueryClient();
  
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentModule = modules.find(m => m.slug === slug);

  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [newEntry, setNewEntry] = useState({ name: '', phone: '', partySize: 2, notes: '' });

  // Fetch waitlist
  const { data: waitlist = [], isLoading, refetch } = useQuery({
    queryKey: ['waitlist', currentModule?.id],
    queryFn: async () => {
      if (!currentModule) return [];
      const res = await api.get(`/${slug}/waitlist`, { params: { moduleId: currentModule.id } });
      return res.data.data || [];
    },
    enabled: !!currentModule,
  });

  // Real-time waitlist updates via Socket.IO
  const handleWaitlistUpdate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['waitlist'] });
  }, [queryClient]);
  useWaitlistUpdates(handleWaitlistUpdate);

  // Add to waitlist
  const addMutation = useMutation({
    mutationFn: async (data: { name: string; phone: string; partySize: number; notes: string }) => {
      if (!currentModule) throw new Error('No module');
      const res = await api.post(`/${slug}/waitlist`, {
        guest_name: data.name,
        phone: data.phone,
        party_size: data.partySize,
        notes: data.notes,
        module_id: currentModule.id
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      setShowAddModal(false);
      setNewEntry({ name: '', phone: '', partySize: 2, notes: '' });
      toast.success('Added to waitlist');
    },
    onError: () => {
      toast.error('Failed to add to waitlist');
    }
  });

  // Update status
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const res = await api.patch(`/${slug}/waitlist/${id}`, { status });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      toast.success('Status updated');
    },
    onError: () => {
      toast.error('Failed to update status');
    }
  });

  // Notify guest (send SMS)
  const notifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.post(`/${slug}/waitlist/${id}/notify`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      toast.success('Guest notified');
    },
    onError: () => {
      toast.error('Failed to notify guest');
    }
  });

  // Remove from waitlist
  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await api.delete(`/${slug}/waitlist/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      toast.success('Removed from waitlist');
    }
  });

  // Filter and sort
  const activeEntries = waitlist
    .filter((e: WaitlistEntry) => e.status === 'waiting' || e.status === 'notified')
    .filter((e: WaitlistEntry) => 
      !searchTerm || 
      e.guest_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      e.phone.includes(searchTerm)
    )
    .sort((a: WaitlistEntry, b: WaitlistEntry) => a.position - b.position);

  const completedEntries = waitlist
    .filter((e: WaitlistEntry) => e.status === 'seated' || e.status === 'cancelled' || e.status === 'no_show')
    .slice(0, 10);

  // Stats
  const stats = {
    waiting: waitlist.filter((e: WaitlistEntry) => e.status === 'waiting').length,
    notified: waitlist.filter((e: WaitlistEntry) => e.status === 'notified').length,
    seated: waitlist.filter((e: WaitlistEntry) => e.status === 'seated').length,
    avgWait: Math.round(
      waitlist
        .filter((e: WaitlistEntry) => e.status === 'waiting')
        .reduce((sum: number, e: WaitlistEntry) => sum + (e.estimated_wait || 15), 0) /
        Math.max(waitlist.filter((e: WaitlistEntry) => e.status === 'waiting').length, 1)
    )
  };

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', { 
      hour: 'numeric', 
      minute: '2-digit' 
    });
  };

  const getWaitTime = (createdAt: string) => {
    const diff = Date.now() - new Date(createdAt).getTime();
    const mins = Math.floor(diff / 60000);
    return mins < 60 ? `${mins}m` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
  };

  if (!currentModule) return null;

  return (
    <div className="space-y-4 sm:space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
            {currentModule.name} Waitlist
          </h1>
          <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400">Manage walk-in guests</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => refetch()}
            className="p-2 rounded-lg border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
          <button 
            onClick={() => setShowAddModal(true)}
            className="flex items-center justify-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors flex-1 sm:flex-initial"
          >
            <Plus className="w-4 h-4" />
            <span>Add Guest</span>
          </button>
        </div>
      </div>

      {/* Stats Cards - Responsive grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-yellow-100 dark:bg-yellow-900/30 flex-shrink-0">
              <Clock className="w-4 sm:w-5 h-4 sm:h-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{stats.waiting}</p>
              <p className="text-xs sm:text-sm text-slate-500">Waiting</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex-shrink-0">
              <Bell className="w-4 sm:w-5 h-4 sm:h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{stats.notified}</p>
              <p className="text-xs sm:text-sm text-slate-500">Notified</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30 flex-shrink-0">
              <UserCheck className="w-4 sm:w-5 h-4 sm:h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{stats.seated}</p>
              <p className="text-xs sm:text-sm text-slate-500">Seated</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-3 sm:p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-slate-100 dark:bg-slate-700 flex-shrink-0">
              <Clock className="w-4 sm:w-5 h-4 sm:h-5 text-slate-600 dark:text-slate-400" />
            </div>
            <div>
              <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">{stats.avgWait}m</p>
              <p className="text-xs sm:text-sm text-slate-500">Avg Wait</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full sm:max-w-md pl-10 pr-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg bg-white dark:bg-slate-800 text-slate-900 dark:text-white"
        />
      </div>

      {/* Active Waitlist */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
          <h2 className="font-semibold text-slate-900 dark:text-white">Active Waitlist</h2>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <Loader2 className="w-8 h-8 animate-spin mx-auto text-primary" />
          </div>
        ) : activeEntries.length === 0 ? (
          <div className="p-8 text-center">
            <Users className="w-12 h-12 mx-auto text-slate-400 mb-3" />
            <p className="text-slate-600 dark:text-slate-400">No guests waiting</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {activeEntries.map((entry: WaitlistEntry) => (
              <div
                key={entry.id}
                className={`p-3 sm:p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors ${
                  entry.status === 'notified' ? 'bg-blue-50/50 dark:bg-blue-900/10' : ''
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3 sm:gap-4">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center font-bold text-primary flex-shrink-0">
                      {entry.position}
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-slate-900 dark:text-white truncate">
                          {entry.guest_name}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${statusColors[entry.status]}`}>
                          {entry.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 sm:gap-3 text-xs sm:text-sm text-slate-600 dark:text-slate-400 flex-wrap">
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" />
                          {entry.party_size}
                        </span>
                        <span className="flex items-center gap-1 truncate">
                          <Phone className="w-3 h-3" />
                          {entry.phone}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          {getWaitTime(entry.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap ml-12 sm:ml-0">
                    {entry.status === 'waiting' && (
                      <button
                        onClick={() => notifyMutation.mutate(entry.id)}
                        disabled={notifyMutation.isPending}
                        className="px-3 py-1.5 text-xs sm:text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-200 flex items-center gap-1"
                      >
                        <Bell className="w-4 h-4" />
                        <span className="hidden sm:inline">Notify</span>
                      </button>
                    )}
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: entry.id, status: 'seated' })}
                      disabled={updateStatusMutation.isPending}
                      className="px-3 py-1.5 text-xs sm:text-sm bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 rounded-lg hover:bg-green-200 flex items-center gap-1"
                    >
                      <UserCheck className="w-4 h-4" />
                      <span className="hidden sm:inline">Seat</span>
                    </button>
                    <button
                      onClick={() => updateStatusMutation.mutate({ id: entry.id, status: 'no_show' })}
                      className="px-2 sm:px-3 py-1.5 text-xs sm:text-sm text-orange-600 hover:bg-orange-50 dark:hover:bg-orange-900/20 rounded-lg"
                    >
                      <span className="hidden sm:inline">No Show</span>
                      <span className="sm:hidden">NS</span>
                    </button>
                    <button
                      onClick={() => {
                        if (confirm('Remove from waitlist?')) {
                          removeMutation.mutate(entry.id);
                        }
                      }}
                      className="p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg"
                    >
                      <UserX className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {entry.notes && (
                  <div className="mt-2 ml-12 sm:ml-14 p-2 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg text-xs sm:text-sm text-amber-800 dark:text-amber-200">
                    <AlertCircle className="w-4 h-4 inline mr-1" />
                    {entry.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Activity */}
      {completedEntries.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700">
            <h2 className="font-semibold text-slate-900 dark:text-white">Recent Activity</h2>
          </div>
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {completedEntries.map((entry: WaitlistEntry) => (
              <div key={entry.id} className="p-3 flex items-center justify-between text-sm">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-slate-900 dark:text-white truncate">{entry.guest_name}</span>
                  <span className="text-slate-500 flex-shrink-0">({entry.party_size})</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={`px-2 py-0.5 rounded-full text-xs ${statusColors[entry.status]}`}>
                    {entry.status}
                  </span>
                  <span className="text-slate-500 text-xs hidden sm:inline">{formatTime(entry.created_at)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add Guest Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-4 sm:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Add to Waitlist
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                addMutation.mutate(newEntry);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newEntry.name}
                  onChange={(e) => setNewEntry({ ...newEntry, name: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Phone
                </label>
                <input
                  type="tel"
                  value={newEntry.phone}
                  onChange={(e) => setNewEntry({ ...newEntry, phone: e.target.value })}
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Party Size
                </label>
                <div className="flex flex-wrap gap-2">
                  {[1, 2, 3, 4, 5, 6, 7, 8].map((size) => (
                    <button
                      key={size}
                      type="button"
                      onClick={() => setNewEntry({ ...newEntry, partySize: size })}
                      className={`w-10 h-10 rounded-lg font-medium ${
                        newEntry.partySize === size
                          ? 'bg-primary text-white'
                          : 'bg-slate-100 dark:bg-slate-700 text-slate-700 dark:text-slate-300'
                      }`}
                    >
                      {size}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Notes (optional)
                </label>
                <input
                  type="text"
                  value={newEntry.notes}
                  onChange={(e) => setNewEntry({ ...newEntry, notes: e.target.value })}
                  placeholder="Special requests, allergies, etc."
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addMutation.isPending || !newEntry.name || !newEntry.phone}
                  className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {addMutation.isPending ? 'Adding...' : 'Add'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
