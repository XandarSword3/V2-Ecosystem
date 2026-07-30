'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Settings,
  Save,
  Loader2,
  Info,
  Percent,
  Truck,
  Utensils
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface OrderConfiguration {
  serviceChargeRate: number;
  deliveryFee: number;
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

// Default configuration matching backend defaults
const defaultConfig: OrderConfiguration = {
  serviceChargeRate: 0.10, // 10%
  deliveryFee: 5
};

export default function OrderSettingsPage() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<OrderConfiguration>(defaultConfig);

  // Fetch configuration
  const { data: fetchedConfig, isLoading } = useQuery({
    queryKey: ['order-configuration'],
    queryFn: async () => {
      try {
        const res = await api.get('/admin/settings/order');
        return res.data?.data || defaultConfig;
      } catch {
        return defaultConfig;
      }
    }
  });

  useEffect(() => {
    if (fetchedConfig) {
      setConfig({
        ...defaultConfig,
        ...fetchedConfig
      });
    }
  }, [fetchedConfig]);

  // Save configuration
  const saveMutation = useMutation({
    mutationFn: async (data: OrderConfiguration) => {
      const res = await api.put('/admin/settings/order', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-configuration'] });
      toast.success('Order settings saved');
    },
    onError: () => {
      toast.error('Failed to save settings');
    }
  });

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Order Settings</h1>
          <p className="text-slate-600 dark:text-slate-400">Configure service charge and delivery fees</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50"
        >
          {saveMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Save className="w-4 h-4" />
          )}
          Save Changes
        </button>
      </div>

      {/* Service Charge */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <Utensils className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Service Charge</h2>
        </div>
        <div className="p-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Service Charge Rate (%)
            </label>
            <div className="flex items-center gap-2">
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={config.serviceChargeRate * 100}
                onChange={(e) => setConfig({ ...config, serviceChargeRate: (parseFloat(e.target.value) || 0) / 100 })}
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
              <span className="text-slate-500">%</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Applied to dine-in orders. Set to 0% to disable.
            </p>
          </div>
        </div>
      </div>

      {/* Delivery Fee */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <Truck className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900 dark:text-white">Delivery Fee</h2>
        </div>
        <div className="p-6">
          <div>
            <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
              Delivery Fee Amount
            </label>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">$</span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={config.deliveryFee}
                onChange={(e) => setConfig({ ...config, deliveryFee: parseFloat(e.target.value) || 0 })}
                className="flex-1 px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <p className="text-xs text-slate-500 mt-1">
              Flat fee applied to delivery orders. Set to 0 to disable.
            </p>
          </div>
        </div>
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-800 dark:text-blue-200">Order Settings Tips</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
              <li>• <strong>Service charge</strong> is a percentage fee typically applied to dine-in orders</li>
              <li>• <strong>Delivery fee</strong> is a flat fee applied to delivery orders</li>
              <li>• These fees are calculated separately from taxes and shown as distinct line items</li>
              <li>• Set rates to 0 to disable specific fees</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
