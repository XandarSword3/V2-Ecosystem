'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
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
  Package,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  DollarSign,
} from 'lucide-react';

interface Addon {
  id: string;
  name: string;
  name_ar?: string;
  description?: string;
  price: number;
  is_available: boolean;
  image_url?: string;
  module_id?: string;
}

export default function DynamicAddonsPage() {
  const params = useParams();
  const { modules } = useSiteSettings();
  const slug = Array.isArray(params?.slug) ? params?.slug[0] : params?.slug;
  const currentModule = modules.find(m => m.slug === slug);

  const [addons, setAddons] = useState<Addon[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Addon | null>(null);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    name_ar: '',
    description: '',
    price: 0,
    is_available: true,
    image_url: '',
  });

  const fetchAddons = useCallback(async () => {
    if (!currentModule) return;
    try {
      const response = await api.get('/chalets/addons', { params: { moduleId: currentModule.id } });
      setAddons(response.data.data || []);
    } catch (error) {
      toast.error('Failed to fetch add-ons');
    } finally {
      setLoading(false);
    }
  }, [currentModule]);

  useEffect(() => {
    if (currentModule) {
      fetchAddons();
    }
  }, [currentModule, fetchAddons]);

  const handleSubmit = async () => {
    if (!formData.name || !currentModule) {
      toast.error('Please fill in all required fields');
      return;
    }
    try {
      setSaving(true);
      const payload = { ...formData, module_id: currentModule.id };
      if (editing) {
        await api.put(`/chalets/admin/addons/${editing.id}`, payload);
        toast.success('Add-on updated');
      } else {
        await api.post('/chalets/admin/addons', payload);
        toast.success('Add-on created');
      }
      setShowModal(false);
      setEditing(null);
      fetchAddons();
    } catch (error) {
      toast.error('Failed to save add-on');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = (addon: Addon) => {
    setEditing(addon);
    setFormData({
      name: addon.name,
      name_ar: addon.name_ar || '',
      description: addon.description || '',
      price: addon.price,
      is_available: addon.is_available,
      image_url: addon.image_url || '',
    });
    setShowModal(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this add-on?')) return;
    try {
      await api.delete(`/chalets/admin/addons/${id}`);
      setAddons((prev) => prev.filter((a) => a.id !== id));
      toast.success('Add-on deleted');
    } catch (error) {
      toast.error('Failed to delete add-on');
    }
  };

  const toggleAvailability = async (addon: Addon) => {
    try {
      await api.put(`/chalets/admin/addons/${addon.id}`, { is_available: !addon.is_available });
      setAddons((prev) => prev.map((a) => (a.id === addon.id ? { ...a, is_available: !a.is_available } : a)));
      toast.success(`Add-on ${addon.is_available ? 'hidden' : 'shown'}`);
    } catch (error) {
      toast.error('Failed to update add-on');
    }
  };

  const openNewModal = () => {
    setEditing(null);
    setFormData({
      name: '',
      name_ar: '',
      description: '',
      price: 0,
      is_available: true,
      image_url: '',
    });
    setShowModal(true);
  };

  if (!currentModule) return null;

  if (loading) {
    return (
      <div className="space-y-6">
        <CardSkeleton />
        <div className="grid md:grid-cols-3 gap-4">
          {[...Array(6)].map((_, i) => <CardSkeleton key={i} />)}
        </div>
      </div>
    );
  }

  return (
    <motion.div variants={staggerContainer} initial="hidden" animate="visible" className="space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{currentModule.name} Add-ons</h1>
          <p className="text-slate-500 dark:text-slate-400">Manage additional services and items</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchAddons}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={openNewModal}>
            <Plus className="w-4 h-4 mr-2" />
            Add Add-on
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Total Add-ons</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">{addons.length}</p>
                </div>
                <Package className="w-8 h-8 text-purple-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>

        <motion.div variants={fadeInUp}>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-500 text-sm">Available</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white">
                    {addons.filter(a => a.is_available).length}
                  </p>
                </div>
                <Eye className="w-8 h-8 text-green-500" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Add-ons Grid */}
      {addons.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Package className="w-12 h-12 mx-auto mb-4 text-slate-400" />
            <p className="text-slate-500 dark:text-slate-400">No add-ons configured</p>
            <Button onClick={openNewModal} className="mt-4">Add your first add-on</Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {addons.map((addon, index) => (
            <motion.div key={addon.id} variants={fadeInUp} transition={{ delay: index * 0.05 }}>
              <Card className={!addon.is_available ? 'opacity-60' : ''}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-purple-100 dark:bg-purple-900/30 flex items-center justify-center">
                        <Package className="w-5 h-5 text-purple-600" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-slate-900 dark:text-white">{addon.name}</h3>
                        {addon.name_ar && <p className="text-sm text-slate-500" dir="rtl">{addon.name_ar}</p>}
                      </div>
                    </div>
                  </div>

                  {addon.description && (
                    <p className="text-sm text-slate-600 dark:text-slate-400 mb-3 line-clamp-2">{addon.description}</p>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-bold text-green-600">{formatCurrency(addon.price)}</span>
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      addon.is_available ? 'bg-green-100 text-green-800' : 'bg-slate-100 text-slate-800'
                    }`}>
                      {addon.is_available ? 'Available' : 'Hidden'}
                    </span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => toggleAvailability(addon)}
                      className={`flex-1 flex items-center justify-center gap-1 py-2 rounded-lg text-sm transition-colors ${
                        addon.is_available
                          ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                          : 'bg-green-100 text-green-600 hover:bg-green-200'
                      }`}
                    >
                      {addon.is_available ? <><EyeOff className="w-4 h-4" />Hide</> : <><Eye className="w-4 h-4" />Show</>}
                    </button>
                    <button onClick={() => handleEdit(addon)} className="p-2 rounded-lg bg-blue-100 text-blue-600 hover:bg-blue-200">
                      <Pencil className="w-4 h-4" />
                    </button>
                    <button onClick={() => handleDelete(addon.id)} className="p-2 rounded-lg bg-red-100 text-red-600 hover:bg-red-200">
                      <Trash2 className="w-4 h-4" />
                    </button>
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
              className="bg-white dark:bg-slate-800 rounded-2xl shadow-xl max-w-md w-full p-6"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-xl font-semibold text-slate-900 dark:text-white">
                  {editing ? 'Edit Add-on' : 'Add Add-on'}
                </h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-700">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name (English) *</label>
                    <Input value={formData.name} onChange={(e) => setFormData({ ...formData, name: e.target.value })} placeholder="e.g., BBQ Equipment" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Name (Arabic)</label>
                    <Input value={formData.name_ar} onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })} placeholder="الاسم بالعربية" dir="rtl" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    placeholder="Describe the add-on..."
                    rows={3}
                    className="w-full px-3 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-white dark:bg-slate-700 text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Price *</label>
                  <div className="relative">
                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                    <Input type="number" step="0.01" value={formData.price} onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })} className="pl-10" />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Image URL</label>
                  <Input value={formData.image_url} onChange={(e) => setFormData({ ...formData, image_url: e.target.value })} placeholder="https://..." />
                </div>

                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_available}
                    onChange={(e) => setFormData({ ...formData, is_available: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-500"
                  />
                  <span className="text-sm text-slate-700 dark:text-slate-300">Available for booking</span>
                </label>
              </div>

              <div className="flex gap-3 mt-6">
                <Button variant="outline" onClick={() => setShowModal(false)} className="flex-1">Cancel</Button>
                <Button onClick={handleSubmit} disabled={saving} className="flex-1">
                  {saving ? <RefreshCw className="w-4 h-4 animate-spin mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                  {editing ? 'Update' : 'Create'}
                </Button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
