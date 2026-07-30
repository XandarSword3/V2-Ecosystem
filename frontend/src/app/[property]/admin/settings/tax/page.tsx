'use client';

import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Percent,
  Plus,
  Trash2,
  Settings,
  Save,
  AlertCircle,
  CheckCircle,
  Info,
  Globe,
  Building2,
  Loader2,
  Edit2,
  X
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';

interface TaxRate {
  id: string;
  name: string;
  rate: number;
  type: 'vat' | 'sales' | 'service' | 'tourism' | 'custom';
  applies_to: string[];
  is_default: boolean;
  is_compound: boolean;
  order: number; // Determines compounding sequence for compound taxes
  jurisdiction?: string;
  description?: string;
  created_at: string;
}

interface TaxConfiguration {
  default_rate: number;
  tax_included_in_price: boolean;
  show_tax_breakdown: boolean;
  rounding_method: 'round' | 'floor' | 'ceil';
  decimal_places: number;
  tax_number?: string;
  tax_name_display?: string;
  rates: TaxRate[];
}

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3005';

const taxTypes = [
  { value: 'vat', label: 'VAT (Value Added Tax)', description: 'Standard consumption tax' },
  { value: 'sales', label: 'Sales Tax', description: 'Point-of-sale tax' },
  { value: 'service', label: 'Service Charge', description: 'Hospitality service fee' },
  { value: 'tourism', label: 'Tourism Tax', description: 'Destination/bed tax' },
  { value: 'custom', label: 'Custom', description: 'Other tax type' }
];

const categoryOptions = [
  { value: 'accommodation', label: 'Accommodation' },
  { value: 'food_beverage', label: 'Food & Beverage' },
  { value: 'spa', label: 'Spa & Wellness' },
  { value: 'pool', label: 'Pool Access' },
  { value: 'activities', label: 'Activities' },
  { value: 'retail', label: 'Retail/Shop' },
  { value: 'transportation', label: 'Transportation' },
  { value: 'events', label: 'Events' },
  { value: 'all', label: 'All Categories' }
];

// Demo default configuration
// FIX: Iteration 4 - Align default tax rate to 11% (Lebanon VAT)
const defaultConfig: TaxConfiguration = {
  default_rate: 11,
  tax_included_in_price: false,
  show_tax_breakdown: true,
  rounding_method: 'round',
  decimal_places: 2,
  tax_number: '',
  tax_name_display: 'Tax',
  rates: [
    {
      id: '1',
      name: 'Standard VAT',
      rate: 11,
      type: 'vat',
      applies_to: ['all'],
      is_default: true,
      is_compound: false,
      order: 1,
      description: 'Standard VAT rate',
      created_at: new Date().toISOString()
    }
  ]
};

export default function TaxConfigurationPage() {
  const queryClient = useQueryClient();
  const [config, setConfig] = useState<TaxConfiguration>(defaultConfig);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);
  const [newRate, setNewRate] = useState<Partial<TaxRate>>({
    name: '',
    rate: 0,
    type: 'vat',
    applies_to: ['all'],
    is_default: false,
    is_compound: false,
    order: 1,
    description: ''
  });

  // Fetch configuration
  const { data: fetchedConfig, isLoading } = useQuery({
    queryKey: ['tax-configuration'],
    queryFn: async () => {
      try {
        const res = await api.get('/admin/settings/tax');
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
        ...fetchedConfig,
        rates: fetchedConfig.rates || defaultConfig.rates
      });
    }
  }, [fetchedConfig]);

  // Save configuration
  const saveMutation = useMutation({
    mutationFn: async (data: TaxConfiguration) => {
      const res = await api.put('/admin/settings/tax', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-configuration'] });
      toast.success('Tax configuration saved');
    },
    onError: () => {
      toast.error('Failed to save configuration');
    }
  });

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  const handleAddRate = () => {
    if (!newRate.name || newRate.rate === undefined) {
      toast.error('Please fill in required fields');
      return;
    }
    const rate: TaxRate = {
      id: Date.now().toString(),
      name: newRate.name,
      rate: newRate.rate,
      type: newRate.type as TaxRate['type'],
      applies_to: newRate.applies_to || ['all'],
      is_default: newRate.is_default || false,
      is_compound: newRate.is_compound || false,
      order: newRate.order || (config.rates.length + 1),
      description: newRate.description,
      created_at: new Date().toISOString()
    };
    
    // If new rate is default, remove default from others
    let updatedRates = config.rates;
    if (rate.is_default) {
      updatedRates = config.rates.map(r => ({ ...r, is_default: false }));
    }
    
    const updated = { ...config, rates: [...updatedRates, rate] };
    setConfig(updated);
    setShowAddModal(false);
    setNewRate({
      name: '',
      rate: 0,
      type: 'vat',
      applies_to: ['all'],
      is_default: false,
      is_compound: false,
      order: 1,
      description: ''
    });
    saveMutation.mutate(updated);
  };

  const handleUpdateRate = () => {
    if (!editingRate) return;
    
    let updatedRates = config.rates.map(r => 
      r.id === editingRate.id ? editingRate : r
    );
    
    // If editing rate is now default, remove default from others
    if (editingRate.is_default) {
      updatedRates = updatedRates.map(r => 
        r.id === editingRate.id ? r : { ...r, is_default: false }
      );
    }
    
    const updated = { ...config, rates: updatedRates };
    setConfig(updated);
    setEditingRate(null);
    saveMutation.mutate(updated);
  };

  const handleDeleteRate = (id: string) => {
    const rate = config.rates.find(r => r.id === id);
    if (rate?.is_default) {
      toast.error('Cannot delete the default tax rate');
      return;
    }
    if (confirm('Delete this tax rate?')) {
      const updated = { ...config, rates: config.rates.filter(r => r.id !== id) };
      setConfig(updated);
      saveMutation.mutate(updated);
    }
  };

  const handleSetDefault = (id: string) => {
    const updatedRates = config.rates.map(r => ({
      ...r,
      is_default: r.id === id
    }));
    const updated = { ...config, rates: updatedRates };
    setConfig(updated);
    saveMutation.mutate(updated);
  };

  const getTypeLabel = (type: string) => {
    return taxTypes.find(t => t.value === type)?.label || type;
  };

  const getCategoryLabels = (categories: string[]) => {
    if (categories.includes('all')) return 'All Categories';
    return categories
      .map(c => categoryOptions.find(o => o.value === c)?.label || c)
      .join(', ');
  };

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Tax Configuration</h1>
          <p className="text-slate-600 dark:text-slate-400">Configure tax rates for your business</p>
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

      {/* General Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <Settings className="w-4 h-4 text-slate-500" />
          <h2 className="font-semibold text-slate-900 dark:text-white">General Settings</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Tax Display Name
              </label>
              <input
                type="text"
                value={config.tax_name_display || ''}
                onChange={(e) => setConfig({ ...config, tax_name_display: e.target.value })}
                placeholder="e.g., VAT, Sales Tax, GST"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
              <p className="text-xs text-slate-500 mt-1">How tax appears on receipts</p>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Tax Registration Number
              </label>
              <input
                type="text"
                value={config.tax_number || ''}
                onChange={(e) => setConfig({ ...config, tax_number: e.target.value })}
                placeholder="e.g., VAT123456789"
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
              <p className="text-xs text-slate-500 mt-1">Displayed on invoices (optional)</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-6">
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Default Tax Rate (%)
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                max="100"
                value={config.default_rate}
                onChange={(e) => setConfig({ ...config, default_rate: parseFloat(e.target.value) || 0 })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Rounding Method
              </label>
              <select
                value={config.rounding_method}
                onChange={(e) => setConfig({ ...config, rounding_method: e.target.value as TaxConfiguration['rounding_method'] })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value="round">Standard Rounding</option>
                <option value="floor">Round Down</option>
                <option value="ceil">Round Up</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-2">
                Decimal Places
              </label>
              <select
                value={config.decimal_places}
                onChange={(e) => setConfig({ ...config, decimal_places: parseInt(e.target.value) })}
                className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
              >
                <option value={0}>0 (No decimals)</option>
                <option value={2}>2 (Standard)</option>
                <option value={3}>3 (High precision)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-col gap-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.tax_included_in_price}
                onChange={(e) => setConfig({ ...config, tax_included_in_price: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">Tax Included in Prices</span>
                <p className="text-xs text-slate-500">Prices shown already include tax (common in Europe)</p>
              </div>
            </label>
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={config.show_tax_breakdown}
                onChange={(e) => setConfig({ ...config, show_tax_breakdown: e.target.checked })}
                className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary"
              />
              <div>
                <span className="text-sm font-medium text-slate-900 dark:text-white">Show Tax Breakdown</span>
                <p className="text-xs text-slate-500">Display individual tax rates on receipts and invoices</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Tax Rates */}
      <div className="bg-white dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-slate-700 overflow-hidden">
        <div className="px-4 py-3 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Percent className="w-4 h-4 text-slate-500" />
            <h2 className="font-semibold text-slate-900 dark:text-white">Tax Rates</h2>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-3 py-1.5 text-sm bg-primary text-white rounded-lg hover:bg-primary/90"
          >
            <Plus className="w-4 h-4" />
            Add Rate
          </button>
        </div>
        
        {config.rates.length === 0 ? (
          <div className="p-8 text-center">
            <Percent className="w-12 h-12 mx-auto text-slate-400 mb-3" />
            <p className="text-slate-600 dark:text-slate-400">No tax rates configured</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              Add Your First Tax Rate
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {config.rates.map((rate) => (
              <div key={rate.id} className="p-4 hover:bg-slate-50 dark:hover:bg-slate-700/30">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-xl bg-primary/10 flex items-center justify-center">
                      <span className="text-xl font-bold text-primary">{rate.rate}%</span>
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900 dark:text-white">{rate.name}</span>
                        {rate.is_default && (
                          <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 text-xs rounded-full">
                            Default
                          </span>
                        )}
                        {rate.is_compound && (
                          <span className="px-2 py-0.5 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-xs rounded-full">
                            Compound
                          </span>
                        )}
                      </div>
                      <div className="text-sm text-slate-600 dark:text-slate-400 mt-1">
                        {getTypeLabel(rate.type)} • {getCategoryLabels(rate.applies_to)}
                      </div>
                      {rate.description && (
                        <p className="text-xs text-slate-500 mt-1">{rate.description}</p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {!rate.is_default && (
                      <button
                        onClick={() => handleSetDefault(rate.id)}
                        className="px-3 py-1.5 text-sm text-primary hover:bg-primary/10 rounded-lg"
                      >
                        Set Default
                      </button>
                    )}
                    <button
                      onClick={() => setEditingRate(rate)}
                      className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDeleteRate(rate.id)}
                      disabled={rate.is_default}
                      className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-medium text-blue-800 dark:text-blue-200">Tax Configuration Tips</h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 mt-2 space-y-1">
              <li>• <strong>Compound taxes</strong> are calculated on top of other taxes (e.g., PST on GST+subtotal)</li>
              <li>• Use category-specific rates for different tax rules (e.g., lower VAT on accommodation)</li>
              <li>• The <strong>default rate</strong> applies when no specific category rate is configured</li>
              <li>• Consult with a tax professional for jurisdiction-specific requirements</li>
            </ul>
          </div>
        </div>
      </div>

      {/* Add Rate Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Add Tax Rate</h2>
              <button onClick={() => setShowAddModal(false)} className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Name *
                </label>
                <input
                  type="text"
                  value={newRate.name}
                  onChange={(e) => setNewRate({ ...newRate, name: e.target.value })}
                  placeholder="e.g., Standard VAT"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Rate (%) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={newRate.rate}
                    onChange={(e) => setNewRate({ ...newRate, rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                    Type
                  </label>
                  <select
                    value={newRate.type}
                    onChange={(e) => setNewRate({ ...newRate, type: e.target.value as TaxRate['type'] })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {taxTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Applies To
                </label>
                <select
                  multiple
                  value={newRate.applies_to}
                  onChange={(e) => {
                    const values = Array.from(e.target.selectedOptions, opt => opt.value);
                    setNewRate({ ...newRate, applies_to: values });
                  }}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white h-32"
                >
                  {categoryOptions.map(c => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <p className="text-xs text-slate-500 mt-1">Hold Ctrl/Cmd to select multiple</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                  Description
                </label>
                <input
                  type="text"
                  value={newRate.description || ''}
                  onChange={(e) => setNewRate({ ...newRate, description: e.target.value })}
                  placeholder="Optional description"
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newRate.is_default}
                    onChange={(e) => setNewRate({ ...newRate, is_default: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Set as default rate</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={newRate.is_compound}
                    onChange={(e) => setNewRate({ ...newRate, is_compound: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Compound tax (calculated on subtotal + other taxes)</span>
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddRate}
                  className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  Add Rate
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Rate Modal */}
      {editingRate && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-slate-800 rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Edit Tax Rate</h2>
              <button onClick={() => setEditingRate(null)} className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name</label>
                <input
                  type="text"
                  value={editingRate.name}
                  onChange={(e) => setEditingRate({ ...editingRate, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRate.rate}
                    onChange={(e) => setEditingRate({ ...editingRate, rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Type</label>
                  <select
                    value={editingRate.type}
                    onChange={(e) => setEditingRate({ ...editingRate, type: e.target.value as TaxRate['type'] })}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {taxTypes.map(t => (
                      <option key={t.value} value={t.value}>{t.label}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                <input
                  type="text"
                  value={editingRate.description || ''}
                  onChange={(e) => setEditingRate({ ...editingRate, description: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingRate.is_default}
                    onChange={(e) => setEditingRate({ ...editingRate, is_default: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Set as default rate</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editingRate.is_compound}
                    onChange={(e) => setEditingRate({ ...editingRate, is_compound: e.target.checked })}
                    className="w-4 h-4 rounded"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Compound tax</span>
                </label>
              </div>
              <div className="flex gap-3 pt-2">
                <button
                  onClick={() => setEditingRate(null)}
                  className="flex-1 py-2 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleUpdateRate}
                  className="flex-1 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
                >
                  Save Changes
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
