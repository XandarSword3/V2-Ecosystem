'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  DollarSign,
  Calendar,
  Percent,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Home,
  Users,
  Sun,
  Moon,
} from 'lucide-react';

interface PricingRule {
  id: string;
  name: string;
  chalet_id?: string;
  base_price: number;
  weekend_price?: number;
  holiday_price?: number;
  per_guest_price?: number;
  min_guests: number;
  max_guests: number;
  start_date?: string;
  end_date?: string;
  is_active: boolean;
  created_at: string;
  chalets?: {
    name: string;
  };
}

interface Chalet {
  id: string;
  name: string;
}

export default function AdminChaletPricingPage() {
  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [chalets, setChalets] = useState<Chalet[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    chalet_id: '',
    base_price: 0,
    weekend_price: 0,
    holiday_price: 0,
    per_guest_price: 0,
    min_guests: 1,
    max_guests: 10,
    start_date: '',
    end_date: '',
    is_active: true,
  });

  const fetchPricingRules = useCallback(async () => {
    try {
      const [rulesRes, chaletsRes] = await Promise.all([
        api.get('/chalets/admin/price-rules'),
        api.get('/chalets'),
      ]);
      setPricingRules(rulesRes.data.data || []);
      setChalets(chaletsRes.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch pricing rules');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchPricingRules();
  }, [fetchPricingRules]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/chalets/admin/price-rules/${editing.id}`, formData);
        toast.success('Pricing rule updated');
      } else {
        await api.post('/chalets/admin/price-rules', formData);
        toast.success('Pricing rule created');
      }
      setShowModal(false);
      setEditing(null);
      fetchPricingRules();
    } catch (error) {
      toast.error('Failed to save pricing rule');
    }
  };

  const handleEdit = (rule: PricingRule) => {
    setEditing(rule);
    setFormData({
      name: rule.name,
      chalet_id: rule.chalet_id || '',
      base_price: rule.base_price,
      weekend_price: rule.weekend_price || 0,
      holiday_price: rule.holiday_price || 0,
      per_guest_price: rule.per_guest_price || 0,
      min_guests: rule.min_guests,
      max_guests: rule.max_guests,
      start_date: rule.start_date || '',
      end_date: rule.end_date || '',
      is_active: rule.is_active,
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this pricing rule?')) return;
    try {
      await api.delete(`/chalets/admin/price-rules/${id}`);
      setPricingRules((prev) => prev.filter((r) => r.id !== id));
      toast.success('Pricing rule deleted');
    } catch (error) {
      toast.error('Failed to delete pricing rule');
    }
  };

  const toggleActive = async (rule: PricingRule) => {
    try {
      await api.put(`/chalets/admin/price-rules/${rule.id}`, { is_active: !rule.is_active });
      setPricingRules((prev) =>
        prev.map((r) => (r.id === rule.id ? { ...r, is_active: !r.is_active } : r))
      );
      toast.success(`Rule ${rule.is_active ? 'deactivated' : 'activated'}`);
    } catch (error) {
      toast.error('Failed to update rule');
    }
  };

  const openNewModal = () => {
    setEditing(null);
    setFormData({
      name: '',
      chalet_id: '',
      base_price: 0,
      weekend_price: 0,
      holiday_price: 0,
      per_guest_price: 0,
      min_guests: 1,
      max_guests: 10,
      start_date: '',
      end_date: '',
      is_active: true,
    });
    setShowModal(true);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <div className="grid md:grid-cols-2 gap-4">
          {[...Array(4)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Chalet Pricing</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage pricing rules and rates</p>
        </div>
        <Button onClick={openNewModal}>
          <Plus className="w-4 h-4 mr-2" />
          Add Pricing Rule
        </Button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Total Rules</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{pricingRules.length}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Active Rules</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {pricingRules.filter((r) => r.is_active).length}
                  </p>
                </div>
                <Percent className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Chalets</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{chalets.length}</p>
                </div>
                <Home className="w-8 h-8 text-amber-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Avg Base Price</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {formatCurrency(
                      pricingRules.length
                        ? pricingRules.reduce((sum, r) => sum + r.base_price, 0) / pricingRules.length
                        : 0
                    )}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Pricing Rules Grid */}
      <div className="grid md:grid-cols-2 gap-4">
        <AnimatePresence mode="popLayout">
          {pricingRules.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <DollarSign className="w-12 h-12 mx-auto text-slate-300 dark:text-slate-600 mb-4" />
              <p className="text-slate-500 dark:text-slate-400">No pricing rules yet</p>
              <Button className="mt-4" onClick={openNewModal}>
                <Plus className="w-4 h-4 mr-2" />
                Add First Rule
              </Button>
            </div>
          ) : (
            pricingRules.map((rule, index) => (
              <motion.div
                key={rule.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                layout
              >
                <Card className={!rule.is_active ? 'opacity-60' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{rule.name}</h3>
                        {rule.chalets && (
                          <p className="text-sm text-slate-500 flex items-center gap-1">
                            <Home className="w-3 h-3" />
                            {rule.chalets.name}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => toggleActive(rule)}
                          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
                            rule.is_active
                              ? 'bg-green-100 text-green-600 dark:bg-green-900/30 dark:text-green-400'
                              : 'bg-slate-100 text-slate-400 dark:bg-slate-700'
                          }`}
                        >
                          {rule.is_active ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
                        </button>
                        <button
                          onClick={() => handleEdit(rule)}
                          className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400 flex items-center justify-center"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(rule.id)}
                          className="w-8 h-8 rounded-full bg-red-100 text-red-600 dark:bg-red-900/30 dark:text-red-400 flex items-center justify-center"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-sm">
                      <div className="bg-slate-50 dark:bg-slate-800 p-2 rounded">
                        <p className="text-slate-500 text-xs">Base Price</p>
                        <p className="font-bold text-slate-900 dark:text-white">{formatCurrency(rule.base_price)}</p>
                      </div>
                      {rule.weekend_price ? (
                        <div className="bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
                          <p className="text-blue-500 text-xs">Weekend</p>
                          <p className="font-bold text-blue-700 dark:text-blue-400">{formatCurrency(rule.weekend_price)}</p>
                        </div>
                      ) : null}
                      {rule.holiday_price ? (
                        <div className="bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
                          <p className="text-amber-500 text-xs">Holiday</p>
                          <p className="font-bold text-amber-700 dark:text-amber-400">{formatCurrency(rule.holiday_price)}</p>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center gap-4 mt-3 text-sm text-slate-500">
                      <span className="flex items-center gap-1">
                        <Users className="w-4 h-4" />
                        {rule.min_guests}-{rule.max_guests} guests
                      </span>
                      {rule.per_guest_price ? (
                        <span>+{formatCurrency(rule.per_guest_price)}/extra guest</span>
                      ) : null}
                    </div>

                    {(rule.start_date || rule.end_date) && (
                      <div className="mt-2 text-xs text-slate-400 flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        {rule.start_date} - {rule.end_date || 'Open'}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-lg bg-white dark:bg-slate-800 rounded-xl shadow-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                    {editing ? 'Edit Pricing Rule' : 'Add Pricing Rule'}
                  </h2>
                  <button
                    onClick={() => setShowModal(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-700 flex items-center justify-center"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Rule Name
                    </label>
                    <input
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      placeholder="e.g., Summer Season 2024"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                      Chalet (Optional)
                    </label>
                    <select
                      value={formData.chalet_id}
                      onChange={(e) => setFormData({ ...formData, chalet_id: e.target.value })}
                      className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                    >
                      <option value="">All Chalets (Default)</option>
                      {chalets.map((c) => (
                        <option key={c.id} value={c.id}>{c.name}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Base Price
                      </label>
                      <input
                        type="number"
                        required
                        min="0"
                        step="0.01"
                        value={formData.base_price}
                        onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Weekend Price
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.weekend_price}
                        onChange={(e) => setFormData({ ...formData, weekend_price: parseFloat(e.target.value) })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Holiday Price
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.holiday_price}
                        onChange={(e) => setFormData({ ...formData, holiday_price: parseFloat(e.target.value) })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Min Guests
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={formData.min_guests}
                        onChange={(e) => setFormData({ ...formData, min_guests: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Max Guests
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={formData.max_guests}
                        onChange={(e) => setFormData({ ...formData, max_guests: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Extra Guest
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={formData.per_guest_price}
                        onChange={(e) => setFormData({ ...formData, per_guest_price: parseFloat(e.target.value) })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        Start Date
                      </label>
                      <input
                        type="date"
                        value={formData.start_date}
                        onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                        End Date
                      </label>
                      <input
                        type="date"
                        value={formData.end_date}
                        onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
                        className="w-full px-4 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-white"
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="is_active"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="rounded border-slate-300"
                    />
                    <label htmlFor="is_active" className="text-sm text-slate-700 dark:text-slate-300">
                      Active
                    </label>
                  </div>

                  <div className="flex gap-3 pt-4">
                    <Button type="button" variant="outline" className="flex-1" onClick={() => setShowModal(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" className="flex-1">
                      <Save className="w-4 h-4 mr-2" />
                      {editing ? 'Update' : 'Create'}
                    </Button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
