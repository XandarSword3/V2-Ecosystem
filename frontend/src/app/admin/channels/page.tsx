'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Globe,
  Settings,
  RefreshCw,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  Activity,
  TrendingUp,
  Calendar,
  Building2,
  Link as LinkIcon,
  Unlink,
  Loader2,
  ChevronRight,
  MoreHorizontal
} from 'lucide-react';
import { toast } from 'sonner';
import { useProperty } from '@/context/PropertyContext';
import api from '@/lib/api';

interface Channel {
  id: string;
  name: string;
  type: 'booking_com' | 'expedia' | 'airbnb' | 'agoda' | 'trip_com' | 'custom';
  status: 'connected' | 'disconnected' | 'error' | 'syncing';
  last_sync?: string;
  sync_errors?: number;
  rooms_mapped: number;
  rates_mapped: number;
  bookings_today: number;
  revenue_mtd: number;
  commission_rate: number;
  config?: {
    hotel_id?: string;
    api_key?: string;
    property_code?: string;
  };
}

interface SyncLog {
  id: string;
  channel_id: string;
  type: 'availability' | 'rates' | 'bookings' | 'inventory';
  status: 'success' | 'failed' | 'partial';
  records_synced: number;
  errors?: string[];
  created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

const channelLogos: Record<string, string> = {
  booking_com: '🅱️',
  booking: '🅱️',
  expedia: '🔵',
  airbnb: '🏠',
  agoda: '🟣',
  trip_com: '✈️',
  custom: '🔗',
};

const channelNames: Record<string, string> = {
  booking_com: 'Booking.com',
  booking: 'Booking.com',
  expedia: 'Expedia',
  airbnb: 'Airbnb',
  agoda: 'Agoda',
  trip_com: 'Trip.com',
  custom: 'Custom Channel',
};

const CHANNEL_CODE_MAP: Record<string, string> = {
  booking_com: 'BOOKING',
  expedia: 'EXPEDIA',
  airbnb: 'AIRBNB',
  agoda: 'AGODA',
  trip_com: 'TRIPADVISOR', // backend supports TRIPADVISOR; keep UI label as Trip.com
};

function normalizeChannelType(code: unknown): string {
  const normalized = String(code || '').toLowerCase();
  if (normalized === 'booking') return 'booking_com';
  if (normalized === 'tripadvisor') return 'trip_com';
  return normalized || 'custom';
}

const statusColors: Record<string, string> = {
  connected: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  disconnected: 'bg-slate-100 text-slate-800 dark:bg-slate-700 dark:text-slate-300',
  error: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  syncing: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
};

// Demo data since backend may not have all endpoints
const demoChannels: Channel[] = [
  {
    id: '1',
    name: 'Booking.com',
    type: 'booking_com',
    status: 'connected',
    last_sync: new Date(Date.now() - 5 * 60000).toISOString(),
    rooms_mapped: 45,
    rates_mapped: 12,
    bookings_today: 8,
    revenue_mtd: 45680,
    commission_rate: 15
  },
  {
    id: '2',
    name: 'Expedia',
    type: 'expedia',
    status: 'connected',
    last_sync: new Date(Date.now() - 15 * 60000).toISOString(),
    rooms_mapped: 45,
    rates_mapped: 10,
    bookings_today: 3,
    revenue_mtd: 18920,
    commission_rate: 18
  },
  {
    id: '3',
    name: 'Airbnb',
    type: 'airbnb',
    status: 'error',
    last_sync: new Date(Date.now() - 60 * 60000).toISOString(),
    sync_errors: 3,
    rooms_mapped: 20,
    rates_mapped: 5,
    bookings_today: 0,
    revenue_mtd: 8450,
    commission_rate: 3
  },
  {
    id: '4',
    name: 'Agoda',
    type: 'agoda',
    status: 'disconnected',
    rooms_mapped: 0,
    rates_mapped: 0,
    bookings_today: 0,
    revenue_mtd: 0,
    commission_rate: 12
  }
];

export default function ChannelManagerPage() {
  const queryClient = useQueryClient();
  const [selectedChannel, setSelectedChannel] = useState<Channel | null>(null);
  const [showConnectModal, setShowConnectModal] = useState(false);
  const [connectForm, setConnectForm] = useState({ type: 'booking_com', hotelId: '', apiKey: '' });
  const [fetchError, setFetchError] = useState<string | null>(null);

  const { activePropertyId } = useProperty();

  // Fetch channels (connections)
  const { data: channels = [], isLoading } = useQuery({
    queryKey: ['channels'],
    queryFn: async () => {
      try {
        const propertyId = activePropertyId;
        const res = await api.get(`/channels/properties/${propertyId}/connections`);
        const data = res.data;
        setFetchError(null);
        // Transform backend data to frontend format
        return (data.connections || []).map((conn: any) => ({
          id: conn.id,
          name: channelNames[normalizeChannelType(conn.channel_code)] || conn.channel_name,
          type: normalizeChannelType(conn.channel_code),
          status: conn.status === 'active' ? 'connected' : conn.status,
          last_sync: conn.last_sync_at,
          sync_errors: conn.error_count,
          rooms_mapped: 0, // Would need separate query
          rates_mapped: 0,
          bookings_today: 0,
          revenue_mtd: 0,
          commission_rate: 15,
          config: {
            hotel_id: conn.hotel_code,
            api_key: conn.api_key
          }
        }));
      } catch (error) {
        setFetchError('Could not connect to server');
        return [];
      }
    }
  });

  // Fetch sync logs
  const { data: syncLogs = [] } = useQuery({
    queryKey: ['channel-sync-logs'],
    queryFn: async () => {
      try {
        // Get logs for each connection
        const propertyId = activePropertyId;
        const res = await api.get(`/channels/properties/${propertyId}/connections`);
        const connections = res.data?.connections || [];
        
        // For now, return empty - full implementation would aggregate from all connections
        return [];
      } catch {
        return [];
      }
    }
  });

  // Sync channel
  const syncMutation = useMutation({
    mutationFn: async (channelId: string) => {
      const res = await api.post(`/channels/connections/${channelId}/sync/availability`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Sync started');
    },
    onError: () => {
      toast.error('Failed to start sync');
    }
  });

  // Connect channel
  const connectMutation = useMutation({
    mutationFn: async (data: { type: string; hotelId: string; apiKey: string }) => {
      const propertyId = activePropertyId;
      const res = await api.post(`/channels/properties/${propertyId}/connections`, {
        channel_code: (CHANNEL_CODE_MAP[data.type] || data.type).toUpperCase(),
        channel_name: channelNames[data.type] || data.type,
        hotel_code: data.hotelId,
        api_key: data.apiKey,
        status: 'pending'
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      setShowConnectModal(false);
      toast.success('Channel connected');
    },
    onError: () => {
      toast.error('Failed to connect channel');
    }
  });

  // Disconnect channel
  const disconnectMutation = useMutation({
    mutationFn: async (channelId: string) => {
      const res = await api.delete(`/channels/connections/${channelId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['channels'] });
      toast.success('Channel disconnected');
    }
  });

  // Stats
  const connectedChannels = channels.filter((c: Channel) => c.status === 'connected').length;
  const totalBookingsToday = channels.reduce((sum: number, c: Channel) => sum + c.bookings_today, 0);
  const totalRevenueMTD = channels.reduce((sum: number, c: Channel) => sum + c.revenue_mtd, 0);
  const channelsWithErrors = channels.filter((c: Channel) => c.status === 'error').length;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
  };

  const formatTimeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Channel Manager</h1>
          <p className="text-slate-600 dark:text-slate-400">Manage OTA connections and sync inventory</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => channels.forEach((c: Channel) => c.status === 'connected' && syncMutation.mutate(c.id))}
            className="flex items-center gap-2 px-4 py-2 border border-slate-200 dark:border-slate-700 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
          >
            <RefreshCw className="w-4 h-4" />
            Sync All
          </button>
          <button 
            onClick={() => setShowConnectModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors"
          >
            <LinkIcon className="w-4 h-4" />
            Connect Channel
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
              <Globe className="w-5 h-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{connectedChannels}</p>
              <p className="text-sm text-slate-500">Connected Channels</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-900/30">
              <Calendar className="w-5 h-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{totalBookingsToday}</p>
              <p className="text-sm text-slate-500">Bookings Today</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/30">
              <TrendingUp className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{formatCurrency(totalRevenueMTD)}</p>
              <p className="text-sm text-slate-500">Revenue MTD</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-xl p-4 border border-slate-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${channelsWithErrors > 0 ? 'bg-red-100 dark:bg-red-900/30' : 'bg-slate-100 dark:bg-slate-700'}`}>
              <AlertCircle className={`w-5 h-5 ${channelsWithErrors > 0 ? 'text-red-600 dark:text-red-400' : 'text-slate-500'}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-slate-900 dark:text-white">{channelsWithErrors}</p>
              <p className="text-sm text-slate-500">Channels with Errors</p>
            </div>
          </div>
        </div>
      </div>

      {/* Channels Grid */}
      <div className="grid grid-cols-2 gap-4">
        {channels.map((channel: Channel) => (
          <div
            key={channel.id}
            className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden"
          >
            <div className="p-4 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{channelLogos[channel.type]}</span>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{channelNames[channel.type]}</h3>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[channel.status]}`}>
                    {channel.status === 'syncing' && <Loader2 className="w-3 h-3 inline animate-spin mr-1" />}
                    {channel.status}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {channel.status === 'connected' && (
                  <button
                    onClick={() => syncMutation.mutate(channel.id)}
                    disabled={syncMutation.isPending}
                    className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                  >
                    <RefreshCw className={`w-4 h-4 ${syncMutation.isPending ? 'animate-spin' : ''}`} />
                  </button>
                )}
                <button className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                  <Settings className="w-4 h-4" />
                </button>
              </div>
            </div>

            <div className="p-4">
              {channel.status === 'disconnected' ? (
                <div className="text-center py-6">
                  <Unlink className="w-8 h-8 mx-auto text-slate-400 mb-2" />
                  <p className="text-slate-600 dark:text-slate-400 mb-4">Not connected</p>
                  <button
                    onClick={() => {
                      setConnectForm({ ...connectForm, type: channel.type });
                      setShowConnectModal(true);
                    }}
                    className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                  >
                    Connect
                  </button>
                </div>
              ) : channel.status === 'error' ? (
                <div className="text-center py-4">
                  <div className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 mb-4">
                    <XCircle className="w-6 h-6 mx-auto text-red-500 mb-2" />
                    <p className="text-sm text-red-700 dark:text-red-300">
                      {channel.sync_errors} sync error(s) detected
                    </p>
                  </div>
                  <div className="flex gap-2 justify-center">
                    <button
                      onClick={() => syncMutation.mutate(channel.id)}
                      className="px-3 py-1.5 text-sm bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-lg"
                    >
                      Retry Sync
                    </button>
                    <button className="px-3 py-1.5 text-sm border border-slate-200 dark:border-slate-700 rounded-lg">
                      View Errors
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-4 mb-4">
                    <div>
                      <p className="text-xs text-slate-500">Rooms Mapped</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">{channel.rooms_mapped}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Rate Plans</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">{channel.rates_mapped}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Today's Bookings</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">{channel.bookings_today}</p>
                    </div>
                    <div>
                      <p className="text-xs text-slate-500">Revenue MTD</p>
                      <p className="text-lg font-semibold text-slate-900 dark:text-white">{formatCurrency(channel.revenue_mtd)}</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-xs text-slate-500 pt-3 border-t border-slate-200 dark:border-slate-700">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      Last sync: {channel.last_sync ? formatTimeAgo(channel.last_sync) : 'Never'}
                    </span>
                    <span>Commission: {channel.commission_rate}%</span>
                  </div>
                </>
              )}
            </div>

            {channel.status === 'connected' && (
              <div className="px-4 py-2 bg-slate-50 dark:bg-slate-700/30 border-t border-slate-200 dark:border-slate-700 flex justify-between items-center">
                <button className="text-sm text-primary hover:underline flex items-center gap-1">
                  View Bookings
                  <ChevronRight className="w-4 h-4" />
                </button>
                <button
                  onClick={() => {
                    if (confirm(`Disconnect from ${channelNames[channel.type]}?`)) {
                      disconnectMutation.mutate(channel.id);
                    }
                  }}
                  className="text-sm text-red-600 hover:underline"
                >
                  Disconnect
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Sync Activity */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700">
        <div className="px-4 py-3 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <h2 className="font-semibold text-slate-900 dark:text-white">Recent Sync Activity</h2>
          <Activity className="w-4 h-4 text-slate-400" />
        </div>
        <div className="p-4">
          {syncLogs.length === 0 ? (
            <p className="text-center text-slate-500 py-4">No recent sync activity</p>
          ) : (
            <div className="space-y-2">
              {syncLogs.slice(0, 5).map((log: SyncLog) => (
                <div key={log.id} className="flex items-center justify-between py-2 border-b border-slate-100 dark:border-slate-700 last:border-0">
                  <div className="flex items-center gap-3">
                    {log.status === 'success' ? (
                      <CheckCircle className="w-4 h-4 text-green-500" />
                    ) : log.status === 'failed' ? (
                      <XCircle className="w-4 h-4 text-red-500" />
                    ) : (
                      <AlertCircle className="w-4 h-4 text-yellow-500" />
                    )}
                    <span className="text-sm text-slate-900 dark:text-white capitalize">{log.type}</span>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-slate-500">
                    <span>{log.records_synced} records</span>
                    <span>{formatTimeAgo(log.created_at)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Connect Modal */}
      {showConnectModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">
              Connect Channel
            </h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                connectMutation.mutate(connectForm);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Channel
                </label>
                <select
                  value={connectForm.type}
                  onChange={(e) => setConnectForm({ ...connectForm, type: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                >
                  <option value="booking_com">Booking.com</option>
                  <option value="expedia">Expedia</option>
                  <option value="airbnb">Airbnb</option>
                  <option value="agoda">Agoda</option>
                  <option value="trip_com">Trip.com</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Hotel/Property ID
                </label>
                <input
                  type="text"
                  value={connectForm.hotelId}
                  onChange={(e) => setConnectForm({ ...connectForm, hotelId: e.target.value })}
                  placeholder="e.g., 123456"
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  API Key / Access Token
                </label>
                <input
                  type="password"
                  value={connectForm.apiKey}
                  onChange={(e) => setConnectForm({ ...connectForm, apiKey: e.target.value })}
                  placeholder="••••••••••••"
                  required
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <p className="text-xs text-slate-500">
                Contact each OTA to obtain your API credentials. Iron Paradise Gym uses SiteMinder for channel management.
              </p>
              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowConnectModal(false)}
                  className="flex-1 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={connectMutation.isPending || !connectForm.hotelId || !connectForm.apiKey}
                  className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
                >
                  {connectMutation.isPending ? 'Connecting...' : 'Connect'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
