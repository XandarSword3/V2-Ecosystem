'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  Monitor, 
  Plus, 
  Settings2, 
  Power, 
  AlertTriangle, 
  CheckCircle2,
  WifiOff,
  Key,
  RefreshCw,
  Wrench
} from 'lucide-react';
import { toast } from 'sonner';
import { useProperty } from '@/context/PropertyContext';
import api from '@/lib/api';

interface KioskDevice {
  id: string;
  property_id: string;
  location: string;
  name: string;
  status: 'online' | 'offline' | 'maintenance' | 'error';
  capabilities: string[];
  last_heartbeat: string;
  key_stock: number;
  is_active: boolean;
  config: {
    timeout_seconds?: number;
    language?: string;
    features_enabled?: string[];
  };
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

// Removed static fetchKiosks function to move it inside component for context access

export default function KioskAdminPage() {
  const queryClient = useQueryClient();
  const { activePropertyId } = useProperty();
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedKiosk, setSelectedKiosk] = useState<KioskDevice | null>(null);
  const [newKioskForm, setNewKioskForm] = useState({
    name: '',
    location: '',
    capabilities: [] as string[],
  });

  const { data: kiosks = [], isLoading, error } = useQuery({
    queryKey: ['admin-kiosks', activePropertyId],
    queryFn: async () => {
      if (!activePropertyId) return [];
      try {
        const res = await api.get(`/kiosk/devices/property/${activePropertyId}?includeInactive=true`);
        return res.data?.data || [];
      } catch (err) {
        console.warn('Failed to fetch kiosks:', err);
        return [];
      }
    },
    enabled: !!activePropertyId
  });

  const registerKioskMutation = useMutation({
    mutationFn: async (data: { name: string; location: string; capabilities: string[] }) => {
      const propertyId = activePropertyId;
      const res = await api.post(`/kiosk/devices/${propertyId}`, {
        deviceName: data.name,
        deviceCode: `KIOSK-${Date.now()}`,
        location: data.location,
        capabilities: {
          hasIdScanner: data.capabilities.includes('id_scanner'),
          hasCardReader: data.capabilities.includes('card_reader'),
          hasKeyEncoder: data.capabilities.includes('key_encoder'),
          hasReceiptPrinter: data.capabilities.includes('receipt_printer'),
          hasCamera: data.capabilities.includes('camera'),
        },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-kiosks'] });
      toast.success('Kiosk registered successfully');
      setShowAddModal(false);
      setNewKioskForm({ name: '', location: '', capabilities: [] });
    },
    onError: (error: any) => {
      const message = error?.response?.data?.error || 'Failed to register kiosk';
      toast.error(message);
    }
  });

  const toggleMaintenanceMutation = useMutation({
    mutationFn: async ({ deviceId, enable }: { deviceId: string; enable: boolean }) => {
      const res = await api.post(`/kiosk/devices/${deviceId}/maintenance`, { enabled: enable });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-kiosks'] });
      toast.success('Maintenance mode updated');
    },
    onError: () => toast.error('Failed to update maintenance mode')
  });

  const refillKeysMutation = useMutation({
    mutationFn: async ({ kioskId, quantity }: { kioskId: string; quantity: number }) => {
      const res = await api.post(`/kiosk/key-stock/${kioskId}/refill`, { quantity });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-kiosks'] });
      toast.success('Key stock refilled');
    },
    onError: () => toast.error('Failed to refill keys')
  });

  const deactivateMutation = useMutation({
    mutationFn: async (deviceId: string) => {
      const res = await api.delete(`/kiosk/devices/${deviceId}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-kiosks'] });
      toast.success('Kiosk deactivated');
    },
    onError: () => toast.error('Failed to deactivate kiosk')
  });

  const handleRegisterSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newKioskForm.name.trim()) {
      toast.error('Device name is required');
      return;
    }
    registerKioskMutation.mutate(newKioskForm);
  };

  const toggleCapability = (cap: string) => {
    setNewKioskForm(prev => ({
      ...prev,
      capabilities: prev.capabilities.includes(cap)
        ? prev.capabilities.filter(c => c !== cap)
        : [...prev.capabilities, cap]
    }));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'online': return <CheckCircle2 className="h-5 w-5 text-green-500" />;
      case 'offline': return <WifiOff className="h-5 w-5 text-gray-400" />;
      case 'maintenance': return <Wrench className="h-5 w-5 text-yellow-500" />;
      case 'error': return <AlertTriangle className="h-5 w-5 text-red-500" />;
      default: return <Monitor className="h-5 w-5 text-gray-400" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const colors: Record<string, string> = {
      online: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200',
      offline: 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200',
      maintenance: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
      error: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    };
    return colors[status] || colors.offline;
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4">
        <p className="text-red-800 dark:text-red-200">Failed to load kiosks. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Kiosk Management</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Manage self-service kiosk devices
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-lg hover:bg-primary/90 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Add Kiosk
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 dark:bg-blue-900 rounded-lg">
              <Monitor className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">{kiosks.length}</p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Total Kiosks</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
              <CheckCircle2 className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kiosks.filter((k: KioskDevice) => k.status === 'online').length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Online</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-yellow-100 dark:bg-yellow-900 rounded-lg">
              <Wrench className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kiosks.filter((k: KioskDevice) => k.status === 'maintenance').length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Maintenance</p>
            </div>
          </div>
        </div>
        <div className="bg-white dark:bg-slate-800 rounded-lg p-4 border border-gray-200 dark:border-slate-700">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-red-100 dark:bg-red-900 rounded-lg">
              <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-gray-900 dark:text-white">
                {kiosks.filter((k: KioskDevice) => k.status === 'error').length}
              </p>
              <p className="text-sm text-gray-500 dark:text-gray-400">Errors</p>
            </div>
          </div>
        </div>
      </div>

      {/* Kiosk List */}
      <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 dark:bg-slate-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Device
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Key Stock
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Last Seen
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 dark:divide-slate-700">
              {kiosks.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center">
                    <Monitor className="h-12 w-12 mx-auto text-gray-300 dark:text-gray-600 mb-4" />
                    <p className="text-gray-500 dark:text-gray-400">No kiosks registered yet</p>
                    <button
                      onClick={() => setShowAddModal(true)}
                      className="mt-4 text-primary hover:underline"
                    >
                      Register your first kiosk
                    </button>
                  </td>
                </tr>
              ) : kiosks.map((kiosk: KioskDevice) => (
                <tr key={kiosk.id} className="hover:bg-gray-50 dark:hover:bg-slate-700/50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(kiosk.status)}
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{kiosk.name}</p>
                        <p className="text-sm text-gray-500 dark:text-gray-400">{kiosk.id.slice(0, 8)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadge(kiosk.status)}`}>
                      {kiosk.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-700 dark:text-gray-300">
                    {kiosk.location || 'Not set'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      <Key className="h-4 w-4 text-gray-400" />
                      <span className={`font-medium ${kiosk.key_stock < 10 ? 'text-red-600' : 'text-gray-700 dark:text-gray-300'}`}>
                        {kiosk.key_stock}
                      </span>
                      {kiosk.key_stock < 10 && (
                        <button
                          onClick={() => refillKeysMutation.mutate({ kioskId: kiosk.id, quantity: 50 })}
                          className="text-xs text-primary hover:underline"
                        >
                          Refill
                        </button>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-gray-500 dark:text-gray-400 text-sm">
                    {kiosk.last_heartbeat 
                      ? new Date(kiosk.last_heartbeat).toLocaleString()
                      : 'Never'
                    }
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => setSelectedKiosk(kiosk)}
                        className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200"
                        title="Settings"
                      >
                        <Settings2 className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => toggleMaintenanceMutation.mutate({ 
                          deviceId: kiosk.id, 
                          enable: kiosk.status !== 'maintenance' 
                        })}
                        className={`p-2 ${kiosk.status === 'maintenance' ? 'text-yellow-500' : 'text-gray-400 hover:text-gray-600 dark:hover:text-gray-200'}`}
                        title={kiosk.status === 'maintenance' ? 'Exit Maintenance' : 'Enter Maintenance'}
                      >
                        <Wrench className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('Are you sure you want to deactivate this kiosk?')) {
                            deactivateMutation.mutate(kiosk.id);
                          }
                        }}
                        className="p-2 text-gray-400 hover:text-red-600"
                        title="Deactivate"
                      >
                        <Power className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add/Edit Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 w-full max-w-md mx-4">
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-4">Register New Kiosk</h2>
            <form onSubmit={handleRegisterSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Device Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  placeholder="Lobby Kiosk 1"
                  value={newKioskForm.name}
                  onChange={(e) => setNewKioskForm(prev => ({ ...prev, name: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Location
                </label>
                <input
                  type="text"
                  placeholder="Main Lobby"
                  value={newKioskForm.location}
                  onChange={(e) => setNewKioskForm(prev => ({ ...prev, location: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-gray-900 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Capabilities
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {['id_scanner', 'card_reader', 'key_encoder', 'receipt_printer', 'camera'].map(cap => (
                    <label key={cap} className="flex items-center gap-2">
                      <input 
                        type="checkbox" 
                        className="rounded" 
                        checked={newKioskForm.capabilities.includes(cap)}
                        onChange={() => toggleCapability(cap)}
                      />
                      <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                        {cap.replace('_', ' ')}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => {
                    setShowAddModal(false);
                    setNewKioskForm({ name: '', location: '', capabilities: [] });
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-slate-700"
                  disabled={registerKioskMutation.isPending}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                  disabled={registerKioskMutation.isPending}
                >
                  {registerKioskMutation.isPending ? (
                    <>
                      <RefreshCw className="h-4 w-4 animate-spin" />
                      Registering...
                    </>
                  ) : (
                    'Register'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
