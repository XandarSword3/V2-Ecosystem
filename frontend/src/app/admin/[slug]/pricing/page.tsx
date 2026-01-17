'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { motion, AnimatePresence } from 'framer-motion';
import { api } from '@/lib/api';
import { useSiteSettings } from '@/lib/settings-context';
import { formatCurrency } from '@/lib/utils';
import { toast } from 'sonner';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { CardSkeleton } from '@/components/ui/Skeleton';
import { fadeInUp, staggerContainer } from '@/lib/animations/presets';
import {
  DollarSign,
  Calendar,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Users,
  RefreshCw,
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
  module_id?: string;
}

export default function DynamicPricingPage() {
  const params = useParams();
  const { modules } = useSiteSettings();
  const tc = useTranslations('adminCommon');
  const rawSlug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const slug = rawSlug ? decodeURIComponent(rawSlug).toLowerCase() : '';
  const currentModule = modules.find(m => m.slug.toLowerCase() === slug);

  const [pricingRules, setPricingRules] = useState<PricingRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PricingRule | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
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
    if (!currentModule) return;
    try {
      const response = await api.get('/chalets/admin/price-rules', { params: { moduleId: currentModule.id } });
      setPricingRules(response.data.data || []);
    } catch (error) {
      toast.error(tc('errors.failedToLoad'));
    } finally {
      setLoading(false);
    }
  }, [currentModule]);

  useEffect(() => {
    if (currentModule) {
      fetchPricingRules();
    }
  }, [currentModule, fetchPricingRules]);

  const handleSubmit = async () => {
    if (!formData.name || !currentModule) {
      toast.error(tc('errors.fillRequiredFields'));
      return;
    }
    try {
      setSaving(true);
      const payload = { ...formData, module_id: currentModule.id };
      if (editing) {
        await api.put(`/chalets/admin/price-rules/${editing.id}`, payload);
        toast.success(tc('success.updated'));
      } else {
        await api.post('/chalets/admin/price-rules', payload);
        toast.success(tc('success.created'));
      }
      setShowModal(false);
      setEditing(null);
      fetchPricingRules();
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (rule: PricingRule) => {
    setEditing(rule);
    setFormData({
      name: rule.name,
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
    if (!confirm(tc('pricing.confirmDelete'))) return;
    try {
      await api.delete(`/chalets/admin/price-rules/${id}`);
      setPricingRules((prev) => prev.filter((r) => r.id !== id));
      toast.success(tc('success.deleted'));
    } catch (error) {
      toast.error(tc('errors.failedToSave'));
    }
  };

  const openNewModal = () => {
    setEditing(null);
    setFormData({
      name: '',
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

  if (!currentModule) return null;

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
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{currentModule.name} {tc('pricing.title')}</h1>
          <p className="text-slate-500 dark:text-slate-400">{tc('pricing.manageRules')}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchPricingRules}>
            <RefreshCw className="w-4 h-4 mr-2" />
            {tc('refresh')}
          </Button>
          <Button onClick={openNewModal}>
            <Plus className="w-4 h-4 mr-2" />
            {tc('pricing.addRule')}
          </Button>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">{tc('pricing.totalRules')}</p>
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
                  <p className="text-slate-500 text-sm">{tc('sessions.active')}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {pricingRules.filter(r => r.is_active).length}
                  </p>
                </div>
                <Calendar className="w-8 h-8 text-blue-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Pricing Rules List */}
      {pricingRules.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <DollarSign className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-500 dark:text-slate-400">{tc('pricing.noRulesConfigured')}</p>
            <Button onClick={openNewModal} className="mt-4">{tc('pricing.addFirstRule')}</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 gap-4">
          {pricingRules.map((rule, index) => (
            <motion.div key={rule.id} variants={fadeInUp} transition={{ delay: index * 0.05 }}>
              <Card className={!rule.is_active ? 'opacity-60' : ''}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <h3 className="font-semibold text-slate-900 dark:text-white">{rule.name}</h3>
                      <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium mt-1 ${
                        rule.is_active ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
                      }`}>
                        {rule.is_active ? tc('sessions.active') : tc('sessions.inactive')}
                      </span>
                    </div>
                    <div className="flex gap-1">
                      <button onClick={() => handleEdit(rule)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                        <Pencil className="w-4 h-4 text-blue-500" />
                      </button>
                      <button onClick={() => handleDelete(rule.id)} className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                        <Trash2 className="w-4 h-4 text-red-500" />
                      </button>
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3 text-sm">
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2">
                      <p className="text-xs text-slate-500">{tc('pricing.base')}</p>
                      <p className="font-bold text-green-600">{formatCurrency(rule.base_price)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2">
                      <p className="text-xs text-slate-500">{tc('pricing.weekend')}</p>
                      <p className="font-bold text-blue-600">{formatCurrency(rule.weekend_price || 0)}</p>
                    </div>
                    <div className="bg-slate-50 dark:bg-slate-700/50 rounded-lg p-2">
                      <p className="text-xs text-slate-500">{tc('pricing.holiday')}</p>
                      <p className="font-bold text-purple-600">{formatCurrency(rule.holiday_price || 0)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 mt-3 text-sm text-slate-500">
                    <Users className="w-4 h-4" />
                    {rule.min_guests} - {rule.max_guests} guests
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowModal(false)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {editing ? tc('pricing.editPricingRule') : tc('pricing.addPricingRule')}
                </h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{tc('tables.name')} *</label>
                  <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., Summer Season" />
                </div>

                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{tc('pricing.basePrice')}</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="number" value={formData.base_price} onChange={(e) => setFormData({ ...formData, base_price: parseFloat(e.target.value) || 0 })} className="pl-10" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{tc('pricing.weekend')}</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="number" value={formData.weekend_price} onChange={(e) => setFormData({ ...formData, weekend_price: parseFloat(e.target.value) || 0 })} className="pl-10" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{tc('pricing.holiday')}</label>
                    <div className="relative">
                      <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                      <Input type="number" value={formData.holiday_price} onChange={(e) => setFormData({ ...formData, holiday_price: parseFloat(e.target.value) || 0 })} className="pl-10" />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{tc('pricing.minGuests')}</label>
                    <Input type="number" value={formData.min_guests} onChange={(e) => setFormData({ ...formData, min_guests: parseInt(e.target.value) || 1 })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{tc('pricing.maxGuests')}</label>
                    <Input type="number" value={formData.max_guests} onChange={(e) => setFormData({ ...formData, max_guests: parseInt(e.target.value) || 10 })} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{tc('pricing.startDate')}</label>
                    <Input type="date" value={formData.start_date} onChange={(e) => setFormData({ ...formData, start_date: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">{tc('pricing.endDate')}</label>
                    <Input type="date" value={formData.end_date} onChange={(e) => setFormData({ ...formData, end_date: e.target.value })} />
                  </div>
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">{tc('pricing.ruleIsActive')}</span>
                </label>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">{tc('cancel')}</Button>
                <Button onClick={handleSubmit} disabled={saving} className="flex-1">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {editing ? tc('update') : tc('create')}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
