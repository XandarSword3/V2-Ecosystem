'use client';

import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Percent,
  Plus,
  Trash2,
  Settings,
  Save,
  Info,
  Loader2,
  Edit2,
  X,
  Calculator,
  CreditCard,
  Layers,
  Tag,
  Sparkles
} from 'lucide-react';
import { toast } from 'sonner';
import api from '@/lib/api';
import { useSiteSettings } from '@/lib/settings-context';
import { formatCurrency } from '@/lib/utils';
import { useSettingsStore } from '@/stores/settingsStore';

export interface TaxRate {
  id: string;
  name: string;
  rate: number;
  type: 'vat' | 'sales' | 'service' | 'tourism' | 'custom';
  fee_type?: 'tax' | 'service_charge' | 'resort_fee' | 'delivery_fee' | 'custom';
  applies_to: string[];
  payment_methods?: string[]; // ['cash', 'credit_card', 'room_charge', 'all']
  is_default: boolean;
  is_compound: boolean;
  order: number;
  jurisdiction?: string;
  description?: string;
  created_at?: string;
}

export interface TaxConfiguration {
  default_rate: number;
  tax_included_in_price: boolean;
  show_tax_breakdown: boolean;
  rounding_method: 'round' | 'floor' | 'ceil';
  decimal_places: number;
  tax_number?: string;
  tax_name_display?: string;
  rates: TaxRate[];
}

const feeTypes = [
  { value: 'tax', label: 'Standard Tax / VAT', description: 'Mandatory government consumption tax' },
  { value: 'service_charge', label: 'Service Charge', description: 'Hospitality & staff service fee' },
  { value: 'resort_fee', label: 'Resort / Facility Fee', description: 'Property amenities access charge' },
  { value: 'delivery_fee', label: 'Delivery / Fulfillment Fee', description: 'Order transport surcharge' },
  { value: 'custom', label: 'Custom Surcharge', description: 'Other jurisdiction specific fee' }
];

const paymentMethodOptions = [
  { value: 'all', label: 'All Payment Methods' },
  { value: 'cash', label: 'Cash Only' },
  { value: 'credit_card', label: 'Credit / Debit Card' },
  { value: 'room_charge', label: 'Room Charge / Folio' }
];

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
      fee_type: 'tax',
      applies_to: ['all'],
      payment_methods: ['all'],
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
  const { modules } = useSiteSettings();
  const currency = useSettingsStore((s) => s.currency);

  const [config, setConfig] = useState<TaxConfiguration>(defaultConfig);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingRate, setEditingRate] = useState<TaxRate | null>(null);

  // Simulator state
  const [simSubtotal, setSimSubtotal] = useState<number>(100);
  const [simCategory, setSimCategory] = useState<string>('all');
  const [simPaymentMethod, setSimPaymentMethod] = useState<string>('all');

  const [newRate, setNewRate] = useState<Partial<TaxRate>>({
    name: '',
    rate: 0,
    type: 'vat',
    fee_type: 'tax',
    applies_to: ['all'],
    payment_methods: ['all'],
    is_default: false,
    is_compound: false,
    order: 1,
    description: ''
  });

  // Dynamic module categories derived from active property modules
  const moduleCategories = useMemo(() => {
    const categories = [{ value: 'all', label: 'All Categories / Modules' }];
    (modules || []).forEach((m) => {
      if (m.is_active) {
        categories.push({
          value: m.slug || m.id,
          label: `${m.name} (${m.engine_type.replace(/_/g, ' ')})`
        });
      }
    });
    return categories;
  }, [modules]);

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
      const mergedRates = fetchedConfig.rates || defaultConfig.rates;
      const defaultRateObj = mergedRates.find((r: TaxRate) => r.is_default);
      
      setConfig({
        ...defaultConfig,
        ...fetchedConfig,
        default_rate: defaultRateObj ? defaultRateObj.rate : (fetchedConfig.default_rate ?? defaultConfig.default_rate),
        rates: mergedRates
      });
    }
  }, [fetchedConfig]);

  // Save configuration mutation
  const saveMutation = useMutation({
    mutationFn: async (data: TaxConfiguration) => {
      const res = await api.put('/admin/settings/tax', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-configuration'] });
      toast.success('Tax & Fee configuration saved successfully');
    },
    onError: () => {
      toast.error('Failed to save tax configuration');
    }
  });

  const handleSave = () => {
    saveMutation.mutate(config);
  };

  const handleAddRate = () => {
    if (!newRate.name || newRate.rate === undefined) {
      toast.error('Please fill in required rate name and percentage');
      return;
    }
    const rateItem: TaxRate = {
      id: Date.now().toString(),
      name: newRate.name,
      rate: newRate.rate,
      type: newRate.type as TaxRate['type'],
      fee_type: newRate.fee_type || 'tax',
      applies_to: newRate.applies_to?.length ? newRate.applies_to : ['all'],
      payment_methods: newRate.payment_methods?.length ? newRate.payment_methods : ['all'],
      is_default: newRate.is_default || false,
      is_compound: newRate.is_compound || false,
      order: newRate.order || (config.rates.length + 1),
      description: newRate.description,
      created_at: new Date().toISOString()
    };
    
    let updatedRates = config.rates;
    if (rateItem.is_default) {
      updatedRates = config.rates.map(r => ({ ...r, is_default: false }));
    }
    
    const updated = {
      ...config,
      default_rate: rateItem.is_default ? rateItem.rate : config.default_rate,
      rates: [...updatedRates, rateItem]
    };
    
    setConfig(updated);
    setShowAddModal(false);
    setNewRate({
      name: '',
      rate: 0,
      type: 'vat',
      fee_type: 'tax',
      applies_to: ['all'],
      payment_methods: ['all'],
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
    
    if (editingRate.is_default) {
      updatedRates = updatedRates.map(r => 
        r.id === editingRate.id ? r : { ...r, is_default: false }
      );
    }
    
    const defaultRateObj = updatedRates.find(r => r.is_default);
    const updated = {
      ...config,
      default_rate: defaultRateObj ? defaultRateObj.rate : config.default_rate,
      rates: updatedRates
    };
    
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
    if (confirm('Are you sure you want to delete this tax/fee rate?')) {
      const updated = { ...config, rates: config.rates.filter(r => r.id !== id) };
      setConfig(updated);
      saveMutation.mutate(updated);
    }
  };

  const handleSetDefault = (id: string) => {
    const target = config.rates.find(r => r.id === id);
    if (!target) return;

    const updatedRates = config.rates.map(r => ({
      ...r,
      is_default: r.id === id
    }));
    
    const updated = {
      ...config,
      default_rate: target.rate,
      rates: updatedRates
    };
    
    setConfig(updated);
    saveMutation.mutate(updated);
  };

  // Simulator calculation logic
  const simResult = useMemo(() => {
    const subtotal = Math.max(0, simSubtotal);
    const category = simCategory;
    const paymentMethod = simPaymentMethod;

    // Filter applicable rates
    const applicable = config.rates.filter((r) => {
      const catMatch = r.applies_to.includes('all') || r.applies_to.includes(category);
      const payMatch = !r.payment_methods || r.payment_methods.includes('all') || r.payment_methods.includes(paymentMethod);
      return catMatch && payMatch;
    });

    const nonCompound = applicable.filter(r => !r.is_compound).sort((a, b) => a.order - b.order);
    const compound = applicable.filter(r => r.is_compound).sort((a, b) => a.order - b.order);

    let nonCompoundTotal = 0;
    const breakdown: Array<{ name: string; rate: number; amount: number; is_compound: boolean; type: string }> = [];

    for (const r of nonCompound) {
      const amount = (subtotal * r.rate) / 100;
      nonCompoundTotal += amount;
      breakdown.push({ name: r.name, rate: r.rate, amount, is_compound: false, type: r.fee_type || 'tax' });
    }

    let compoundRunning = nonCompoundTotal;
    for (const r of compound) {
      const base = subtotal + compoundRunning;
      const amount = (base * r.rate) / 100;
      compoundRunning += amount;
      breakdown.push({ name: r.name, rate: r.rate, amount, is_compound: true, type: r.fee_type || 'tax' });
    }

    const totalTaxesAndFees = breakdown.reduce((sum, item) => sum + item.amount, 0);
    const grandTotal = subtotal + totalTaxesAndFees;

    return {
      subtotal,
      breakdown,
      totalTaxesAndFees,
      grandTotal
    };
  }, [config.rates, simSubtotal, simCategory, simPaymentMethod]);

  if (isLoading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 dark:text-white flex items-center gap-2">
            <Percent className="w-6 h-6 text-blue-600" />
            Tax & Fee Configuration
          </h1>
          <p className="text-slate-600 dark:text-slate-400 text-sm mt-1">
            Configure dynamic taxes, service charges, and payment method rules for your business
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saveMutation.isPending}
          className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-md hover:shadow-lg disabled:opacity-50"
        >
          {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Section 1: General Settings */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center gap-2">
          <Settings className="w-5 h-5 text-blue-600" />
          <h2 className="font-bold text-slate-900 dark:text-white">General Invoicing & Tax Rules</h2>
        </div>
        <div className="p-6 space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tax Display Name on Receipts
              </label>
              <input
                type="text"
                value={config.tax_name_display || ''}
                onChange={(e) => setConfig({ ...config, tax_name_display: e.target.value })}
                placeholder="e.g., VAT, Sales Tax, GST"
                className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">Appears on receipts and customer invoices</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Tax Registration / Tax ID Number
              </label>
              <input
                type="text"
                value={config.tax_number || ''}
                onChange={(e) => setConfig({ ...config, tax_number: e.target.value })}
                placeholder="e.g., VAT123456789"
                className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
              />
              <p className="text-xs text-slate-500 mt-1">Printed on formal invoices (optional)</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Effective Default Tax Rate (%)
              </label>
              <div className="relative">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  value={config.default_rate}
                  onChange={(e) => {
                    const newRateVal = parseFloat(e.target.value) || 0;
                    const updatedRates = config.rates.map((r) =>
                      r.is_default ? { ...r, rate: newRateVal } : r
                    );
                    setConfig({ ...config, default_rate: newRateVal, rates: updatedRates });
                  }}
                  className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm font-semibold"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">%</span>
              </div>
              <p className="text-xs text-slate-500 mt-1">Synced with default rate in table</p>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Rounding Method
              </label>
              <select
                value={config.rounding_method}
                onChange={(e) => setConfig({ ...config, rounding_method: e.target.value as TaxConfiguration['rounding_method'] })}
                className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
              >
                <option value="round">Standard Rounding (Half Up)</option>
                <option value="floor">Round Down (Floor)</option>
                <option value="ceil">Round Up (Ceil)</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Decimal Places
              </label>
              <select
                value={config.decimal_places}
                onChange={(e) => setConfig({ ...config, decimal_places: parseInt(e.target.value) })}
                className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white text-sm"
              >
                <option value={0}>0 (Whole integers)</option>
                <option value={2}>2 (Standard currency)</option>
                <option value={3}>3 (High precision)</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t border-slate-100 dark:border-slate-700/60">
            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
              <input
                type="checkbox"
                checked={config.tax_included_in_price}
                onChange={(e) => setConfig({ ...config, tax_included_in_price: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 mt-0.5"
              />
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Tax Included in Catalog Prices</span>
                <p className="text-xs text-slate-500">Catalog item prices already include tax (Gross Pricing / European Model)</p>
              </div>
            </label>

            <label className="flex items-start gap-3 cursor-pointer p-3 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700/40 transition-colors">
              <input
                type="checkbox"
                checked={config.show_tax_breakdown}
                onChange={(e) => setConfig({ ...config, show_tax_breakdown: e.target.checked })}
                className="w-4 h-4 rounded text-blue-600 mt-0.5"
              />
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-white">Show Detailed Tax & Fee Breakdown</span>
                <p className="text-xs text-slate-500">Display itemized tax breakdown on receipts and checkout screens</p>
              </div>
            </label>
          </div>
        </div>
      </div>

      {/* Section 2: Active Tax Rates & Service Fees Table */}
      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-slate-50 dark:bg-slate-700/50 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            <h2 className="font-bold text-slate-900 dark:text-white">Configured Tax Rates & Service Charges</h2>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center gap-2 px-4 py-2 text-sm bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-sm"
          >
            <Plus className="w-4 h-4" />
            Add Tax or Fee Rate
          </button>
        </div>

        {config.rates.length === 0 ? (
          <div className="p-8 text-center">
            <Percent className="w-12 h-12 mx-auto text-slate-300 mb-3" />
            <p className="text-slate-600 dark:text-slate-400">No tax or service fee rates configured</p>
            <button
              onClick={() => setShowAddModal(true)}
              className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl"
            >
              Add Your First Tax Rate
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-200 dark:divide-slate-700">
            {config.rates.map((rate) => {
              const feeTypeLabel = feeTypes.find(f => f.value === (rate.fee_type || 'tax'))?.label || 'Tax Rate';
              const categoriesText = rate.applies_to.includes('all')
                ? 'All Categories'
                : rate.applies_to.map((c) => moduleCategories.find((m) => m.value === c)?.label || c).join(', ');
              const paymentMethodsText = !rate.payment_methods || rate.payment_methods.includes('all')
                ? 'All Payment Methods'
                : rate.payment_methods.map((p) => paymentMethodOptions.find((o) => o.value === p)?.label || p).join(', ');

              return (
                <div key={rate.id} className="p-5 hover:bg-slate-50/80 dark:hover:bg-slate-700/30 transition-colors">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <div className="w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-900/30 border border-blue-100 dark:border-blue-800 flex items-center justify-center">
                        <span className="text-xl font-extrabold text-blue-600 dark:text-blue-400">{rate.rate}%</span>
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-slate-900 dark:text-white text-base">{rate.name}</span>
                          {rate.is_default && (
                            <span className="px-2.5 py-0.5 bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-300 text-xs font-semibold rounded-full border border-green-200 dark:border-green-800">
                              Default Rate
                            </span>
                          )}
                          {rate.is_compound && (
                            <span className="px-2.5 py-0.5 bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300 text-xs font-semibold rounded-full border border-purple-200 dark:border-purple-800">
                              Compound Tax
                            </span>
                          )}
                          <span className="px-2.5 py-0.5 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 text-xs font-medium rounded-full">
                            {feeTypeLabel}
                          </span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 dark:text-slate-400 mt-1.5 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Tag className="w-3.5 h-3.5 text-slate-400" />
                            {categoriesText}
                          </span>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <CreditCard className="w-3.5 h-3.5 text-slate-400" />
                            {paymentMethodsText}
                          </span>
                        </div>

                        {rate.description && (
                          <p className="text-xs text-slate-400 mt-1">{rate.description}</p>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {!rate.is_default && (
                        <button
                          onClick={() => handleSetDefault(rate.id)}
                          className="px-3 py-1.5 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-lg border border-blue-200 dark:border-blue-800 transition-colors"
                        >
                          Make Default
                        </button>
                      )}
                      <button
                        onClick={() => setEditingRate(rate)}
                        className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300"
                        title="Edit rate"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteRate(rate.id)}
                        disabled={rate.is_default}
                        className="p-2 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 text-red-600 disabled:opacity-30 disabled:cursor-not-allowed"
                        title="Delete rate"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Section 3: Live Interactive Tax & Fee Simulator */}
      <div className="bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 text-white rounded-2xl p-6 shadow-xl border border-slate-700">
        <div className="flex items-center justify-between mb-4 border-b border-slate-700 pb-3">
          <div className="flex items-center gap-2">
            <Calculator className="w-5 h-5 text-yellow-400" />
            <h3 className="font-bold text-lg">Interactive Real-Time Tax & Fee Simulator</h3>
          </div>
          <span className="text-xs bg-yellow-400/20 text-yellow-300 px-3 py-1 rounded-full border border-yellow-400/30 font-semibold flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5" />
            Live Preview
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Test Subtotal Amount</label>
            <div className="relative">
              <input
                type="number"
                min="0"
                step="5"
                value={simSubtotal}
                onChange={(e) => setSimSubtotal(parseFloat(e.target.value) || 0)}
                className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-600 text-white font-mono text-sm font-bold"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-bold">$</span>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Module / Category</label>
            <select
              value={simCategory}
              onChange={(e) => setSimCategory(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-600 text-white text-sm"
            >
              {moduleCategories.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1">Payment Method</label>
            <select
              value={simPaymentMethod}
              onChange={(e) => setSimPaymentMethod(e.target.value)}
              className="w-full px-3.5 py-2 rounded-xl bg-slate-800 border border-slate-600 text-white text-sm"
            >
              {paymentMethodOptions.map((p) => (
                <option key={p.value} value={p.value}>{p.label}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Calculation Result Cards */}
        <div className="bg-slate-800/80 rounded-xl p-4 border border-slate-700 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-slate-400">Subtotal:</span>
            <span className="font-mono font-bold">{formatCurrency(simResult.subtotal, currency)}</span>
          </div>

          {simResult.breakdown.length === 0 ? (
            <div className="text-xs text-slate-400 italic py-2">No applicable taxes or service fees for this combination</div>
          ) : (
            <div className="space-y-1.5 py-2 border-t border-b border-slate-700">
              {simResult.breakdown.map((item, i) => (
                <div key={i} className="flex justify-between text-xs">
                  <span className="text-slate-300 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />
                    {item.name} ({item.rate}%{item.is_compound ? ' compound' : ''}):
                  </span>
                  <span className="font-mono text-yellow-300 font-semibold">+{formatCurrency(item.amount, currency)}</span>
                </div>
              ))}
            </div>
          )}

          <div className="flex justify-between items-center text-base pt-1">
            <span className="font-bold text-slate-200">Calculated Total:</span>
            <span className="text-2xl font-black text-emerald-400 font-mono">{formatCurrency(simResult.grandTotal, currency)}</span>
          </div>
        </div>
      </div>

      {/* Info Tip Box */}
      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-2xl p-5">
        <div className="flex items-start gap-3">
          <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
          <div className="text-xs space-y-1.5 text-blue-900 dark:text-blue-200">
            <h4 className="font-bold text-sm text-blue-950 dark:text-blue-100">Tax & Fee Configuration Guidance</h4>
            <p>• <strong>Compounding Sequence:</strong> Non-compound taxes apply to the base subtotal. Compound taxes apply to subtotal + prior taxes.</p>
            <p>• <strong>Payment Method Scoping:</strong> Scoped taxes apply automatically based on customer payment choice during checkout.</p>
            <p>• <strong>Service Charges:</strong> Hospitality service charges are calculated prior to compound taxes.</p>
          </div>
        </div>
      </div>

      {/* Add Rate Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Add New Tax or Service Charge Rate</h3>
              <button onClick={() => setShowAddModal(false)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Rate Name *</label>
                <input
                  type="text"
                  value={newRate.name}
                  onChange={(e) => setNewRate({ ...newRate, name: e.target.value })}
                  placeholder="e.g., Hospitality Service Charge, Resort Bed Tax"
                  className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Rate (%) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={newRate.rate}
                    onChange={(e) => setNewRate({ ...newRate, rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fee Classification</label>
                  <select
                    value={newRate.fee_type || 'tax'}
                    onChange={(e) => setNewRate({ ...newRate, fee_type: e.target.value as any })}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {feeTypes.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Dynamic Module Category Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Applies To Categories / Modules</label>
                <div className="flex flex-wrap gap-1.5 p-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700/50 max-h-32 overflow-y-auto">
                  {moduleCategories.map((c) => {
                    const isSelected = newRate.applies_to?.includes(c.value);
                    return (
                      <button
                        type="button"
                        key={c.value}
                        onClick={() => {
                          let selected = newRate.applies_to || ['all'];
                          if (c.value === 'all') {
                            selected = ['all'];
                          } else {
                            selected = selected.filter(s => s !== 'all');
                            if (isSelected) {
                              selected = selected.filter(s => s !== c.value);
                              if (selected.length === 0) selected = ['all'];
                            } else {
                              selected = [...selected, c.value];
                            }
                          }
                          setNewRate({ ...newRate, applies_to: selected });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-blue-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {c.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Payment Methods Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Payment Method Scoping</label>
                <div className="flex flex-wrap gap-1.5 p-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-slate-50 dark:bg-slate-700/50">
                  {paymentMethodOptions.map((p) => {
                    const isSelected = newRate.payment_methods?.includes(p.value);
                    return (
                      <button
                        type="button"
                        key={p.value}
                        onClick={() => {
                          let selected = newRate.payment_methods || ['all'];
                          if (p.value === 'all') {
                            selected = ['all'];
                          } else {
                            selected = selected.filter(s => s !== 'all');
                            if (isSelected) {
                              selected = selected.filter(s => s !== p.value);
                              if (selected.length === 0) selected = ['all'];
                            } else {
                              selected = [...selected, p.value];
                            }
                          }
                          setNewRate({ ...newRate, payment_methods: selected });
                        }}
                        className={`px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-purple-600 text-white'
                            : 'bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-600'
                        }`}
                      >
                        {p.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRate.is_default}
                    onChange={(e) => setNewRate({ ...newRate, is_default: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Set as primary default tax rate</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={newRate.is_compound}
                    onChange={(e) => setNewRate({ ...newRate, is_compound: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Compound tax (calculated on subtotal + other taxes)</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleAddRate}
                  className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-md"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-800 rounded-2xl p-6 max-w-lg w-full shadow-2xl border border-slate-200 dark:border-slate-700 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200 dark:border-slate-700">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white">Edit Tax or Fee Rate</h3>
              <button onClick={() => setEditingRate(null)} className="p-1 text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 text-sm">
              <div>
                <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Rate Name</label>
                <input
                  type="text"
                  value={editingRate.name}
                  onChange={(e) => setEditingRate({ ...editingRate, name: e.target.value })}
                  className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Rate (%)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={editingRate.rate}
                    onChange={(e) => setEditingRate({ ...editingRate, rate: parseFloat(e.target.value) || 0 })}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white font-semibold"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1">Fee Classification</label>
                  <select
                    value={editingRate.fee_type || 'tax'}
                    onChange={(e) => setEditingRate({ ...editingRate, fee_type: e.target.value as any })}
                    className="w-full px-3.5 py-2 border border-slate-300 dark:border-slate-600 rounded-xl bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  >
                    {feeTypes.map(f => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingRate.is_default}
                    onChange={(e) => setEditingRate({ ...editingRate, is_default: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Set as primary default tax rate</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingRate.is_compound}
                    onChange={(e) => setEditingRate({ ...editingRate, is_compound: e.target.checked })}
                    className="w-4 h-4 text-blue-600 rounded"
                  />
                  <span className="text-xs font-medium text-slate-700 dark:text-slate-300">Compound tax</span>
                </label>
              </div>

              <div className="flex gap-3 pt-4">
                <button
                  type="button"
                  onClick={() => setEditingRate(null)}
                  className="flex-1 py-2.5 border border-slate-300 dark:border-slate-600 text-slate-700 dark:text-slate-300 font-semibold rounded-xl"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleUpdateRate}
                  className="flex-1 py-2.5 bg-blue-600 text-white font-semibold rounded-xl hover:bg-blue-700 transition-all shadow-md"
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
